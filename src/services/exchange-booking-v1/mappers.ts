import { SabreParseError } from '../../errors/sabre-parse-error.js';
import type { components } from '../../generated/exchange-booking.js';
import { ensureTrailingSlash } from '../../http/ensure-trailing-slash.js';
import type { SabreRequest, SabreResponse } from '../../http/types.js';
import type {
  ExchangeApplicationMessage,
  ExchangeApplicationResults,
  ExchangeChangeFee,
  ExchangeConfirm,
  ExchangeConfirmationResult,
  ExchangeDetails,
  ExchangeEmail,
  ExchangeFlightInput,
  ExchangeFlightOutput,
  ExchangeFormOfPayment,
  ExchangeItinTotalFare,
  ExchangeMoney,
  ExchangeNewSegment,
  ExchangePassengerTypeQuantity,
  ExchangePriceBound,
  ExchangePriceQuoteReissue,
  ExchangePriceTolerance,
  ExchangePtcFlightSegment,
  ExchangeSignatureLine,
  ExchangeSystemSpecificResult,
  ExchangeTaxLine,
  ExchangeTaxes,
  ExchangeTransactionInformation,
} from './types.js';

const PATH = 'v1.1.0/exchange/booking';

/**
 * Wire-format version string. The OAS `info.version` is `1.1.0` and
 * every canonical example body in the spec declares
 * `version: "1.1.0"`.
 */
const WIRE_VERSION = '1.1.0';

/** Default name number when the caller omits `nameNumber`. */
const DEFAULT_NAME_NUMBER = '1.1';

/**
 * Default `HaltOnStatus` codes — codes that should halt the sell+price
 * flow if the carrier returns them post-sell.
 *
 * `NN` is intentionally **excluded**. New segments are sold as `NN`
 * ("need"; see {@link DEFAULT_SEGMENT_STATUS}), and the carrier does not
 * always settle that to a confirmed status within the exchange call — so a
 * freshly-sold segment is itself `NN` at the halt check. Including `NN` in
 * the halt list therefore makes the exchange abort on its own just-sold
 * segment (`EnhancedAirBookRQ: Flight … returned status code NN` →
 * `HALT_ON_STATUS_RECEIVED` → "Unable to perform air booking step"). Sabre's
 * canonical example lists `NN` here *and* sells `NN`, which is internally
 * contradictory; we drop `NN` so the sell isn't treated as a failure.
 * `HL`/`UC`/`US`/`NO` etc. remain genuine hard-stop conditions. Callers can
 * override via `haltOnStatus` (including an empty array).
 */
const DEFAULT_HALT_ON_STATUS: readonly string[] = ['HL', 'KK', 'LL', 'NO', 'UC', 'US'];

/**
 * Default per-segment sell status when the caller omits `status`.
 *
 * `NN` ("need") is the documented request status and the value Sabre's
 * canonical example uses — the agent asks the carrier to confirm the new
 * segment, which lets the reissued ticket be issued. This is the correct
 * default. It only commits cleanly when `NN` is **not** in the halt list
 * (see {@link DEFAULT_HALT_ON_STATUS}); otherwise the just-sold `NN`
 * segment trips the halt and the air-book step aborts.
 * Pass `status` per segment to override.
 */
const DEFAULT_SEGMENT_STATUS = 'NN';

/** Default per-segment number-in-party when the caller omits it. */
const DEFAULT_NUMBER_IN_PARTY = '1';

/**
 * Builds the outgoing {@link SabreRequest} for the `exchange`
 * operation (Sabre operationId `exchangeBooking`).
 *
 * The wire body is an `ExchangeBookingRQ` envelope with hardcoded
 * `version: "1.1.0"`. Optional input groups (`Cancel`, `AirBook`,
 * `PriceComparison`, `ExchangeConfirmation`) are omitted from the
 * wire body when the caller doesn't supply them — mirroring the
 * spec's optionality.
 */
export function toExchangeRequest(baseUrl: string, input: ExchangeFlightInput): SabreRequest {
  const url = new URL(PATH, ensureTrailingSlash(baseUrl));

  const rq: Record<string, unknown> = {
    version: WIRE_VERSION,
    Itinerary: { id: input.pnrLocator },
  };

  if (input.targetCity !== undefined) rq.targetCity = input.targetCity;

  if (input.cancelSegments && input.cancelSegments.length > 0) {
    rq.Cancel = {
      Segment: input.cancelSegments.map((n) => ({ Number: n })),
    };
  }

  const airBook = buildAirBook(input);
  if (airBook !== undefined) rq.AirBook = airBook;

  rq.AutomatedExchanges = [buildAutomatedExchange(input)];
  rq.PostProcessing = buildPostProcessing(input);

  return {
    method: 'POST',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ExchangeBookingRQ: rq }),
  };
}

function buildAirBook(input: ExchangeFlightInput): Record<string, unknown> | undefined {
  if (!input.newSegments || input.newSegments.length === 0) return undefined;

  const haltCodes = input.haltOnStatus ?? DEFAULT_HALT_ON_STATUS;
  const airBook: Record<string, unknown> = {
    HaltOnStatus: haltCodes.map((code) => ({ Code: code })),
    OriginDestinationInformation: {
      FlightSegment: input.newSegments.map(buildFlightSegment),
    },
  };

  if (input.haltOnTimeDiscrepancyMinutes !== undefined) {
    airBook.HaltOnTimeDiscrepancy = {
      acceptableThreshold: input.haltOnTimeDiscrepancyMinutes,
    };
  }

  if (input.redisplayReservation !== undefined) {
    airBook.RedisplayReservation = {
      NumAttempts: input.redisplayReservation.numAttempts,
      WaitInterval: input.redisplayReservation.waitInterval,
    };
  }

  return airBook;
}

function buildFlightSegment(seg: ExchangeNewSegment): Record<string, unknown> {
  return {
    ArrivalDateTime: seg.arrivalDateTime,
    DepartureDateTime: seg.departureDateTime,
    FlightNumber: seg.flightNumber,
    NumberInParty: seg.numberInParty ?? DEFAULT_NUMBER_IN_PARTY,
    ResBookDesigCode: seg.bookingClass,
    Status: seg.status ?? DEFAULT_SEGMENT_STATUS,
    DestinationLocation: { LocationCode: seg.destination },
    MarketingAirline: { Code: seg.marketingCarrier, FlightNumber: seg.flightNumber },
    OriginLocation: { LocationCode: seg.origin },
  };
}

function buildAutomatedExchange(input: ExchangeFlightInput): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    ExchangeComparison: buildExchangeComparison(input),
  };
  if (input.priceTolerance !== undefined) {
    entry.PriceComparison = buildPriceComparison(input.priceTolerance);
  }
  if (input.confirm !== undefined) {
    entry.ExchangeConfirmation = buildExchangeConfirmation(input.confirm);
  }
  return entry;
}

function buildExchangeComparison(input: ExchangeFlightInput): Record<string, unknown> {
  const pricingQualifiers: Record<string, unknown> = {
    NameSelect: { NameNumber: input.nameNumber ?? DEFAULT_NAME_NUMBER },
  };
  if (input.bargainFinder !== undefined) {
    pricingQualifiers.BargainFinder = { Rebook: input.bargainFinder };
  }
  if (input.autoRedirect !== undefined) {
    pricingQualifiers.AutoRedirect = input.autoRedirect;
  }
  if (input.commandPricing !== undefined) {
    pricingQualifiers.CommandPricing = input.commandPricing;
  }

  const optionalQualifiers: Record<string, unknown> = {
    PricingQualifiers: pricingQualifiers,
  };
  if (input.validatingCarrier !== undefined) {
    optionalQualifiers.FlightQualifiers = {
      VendorPrefs: { Airline: { Code: input.validatingCarrier } },
    };
  }

  const exchangeComparison: Record<string, unknown> = {
    OriginalTicketNumber: input.originalTicketNumber,
    PriceRequestInformation: { OptionalQualifiers: optionalQualifiers },
  };

  if (input.changeFeeOverride !== undefined) {
    exchangeComparison.ExchangeOverrides = { ChangeFee: input.changeFeeOverride };
  }

  return exchangeComparison;
}

function buildPriceComparison(t: ExchangePriceTolerance): Record<string, unknown> {
  const pc: Record<string, unknown> = { amountSpecified: t.amountSpecified };
  if (t.acceptableIncrease !== undefined) {
    pc.AcceptablePriceIncrease = buildBound(t.acceptableIncrease);
  }
  if (t.acceptableDecrease !== undefined) {
    pc.AcceptablePriceDecrease = buildBound(t.acceptableDecrease);
  }
  return pc;
}

function buildBound(b: ExchangePriceBound): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (b.haltOnNonAcceptablePrice !== undefined) {
    out.haltOnNonAcceptablePrice = b.haltOnNonAcceptablePrice;
  }
  if (b.amount !== undefined) out.Amount = b.amount;
  if (b.percent !== undefined) out.Percent = b.percent;
  return out;
}

function buildExchangeConfirmation(c: ExchangeConfirm): Record<string, unknown> {
  const out: Record<string, unknown> = {
    OptionalQualifiers: {
      FOP_Qualifiers: { BasicFOP: [buildBasicFop(c.formOfPayment)] },
    },
  };
  if (c.waiverCode !== undefined) out.WaiverCode = c.waiverCode;
  if (c.ticketDeliveryOffice !== undefined) out.TicketDeliveryOffice = c.ticketDeliveryOffice;
  return out;
}

/**
 * Builds one `BasicFOP` entry. Per the spec: cash uses `Type: 'CA'`,
 * check uses `Type: 'CK'`, and credit cards omit `Type` entirely and
 * populate `CC_Info.PaymentCard` instead.
 */
function buildBasicFop(fop: ExchangeFormOfPayment): Record<string, unknown> {
  if (fop.type === 'cash') return { Type: 'CA' };
  if (fop.type === 'check') return { Type: 'CK' };
  const card: Record<string, unknown> = {
    Code: fop.vendorCode,
    ExpireDate: fop.expireDate,
    Number: fop.number,
  };
  if (fop.manualApprovalCode !== undefined) card.ManualApprovalCode = fop.manualApprovalCode;
  const ccInfo: Record<string, unknown> = { PaymentCard: card };
  if (fop.suppress !== undefined) ccInfo.Suppress = fop.suppress;
  return { CC_Info: ccInfo };
}

function buildPostProcessing(input: ExchangeFlightInput): Record<string, unknown> {
  const pp: Record<string, unknown> = {
    EndTransaction: { Source: { ReceivedFrom: input.receivedFrom } },
  };
  if (input.returnPQRInfo !== undefined) pp.returnPQRInfo = input.returnPQRInfo;
  if (input.redisplay !== undefined) pp.redisplayReservation = input.redisplay;

  if (input.email !== undefined) {
    const endTx = pp.EndTransaction as Record<string, unknown>;
    endTx.Email = buildEmail(input.email);
  }

  return pp;
}

function buildEmail(email: ExchangeEmail): Record<string, unknown> {
  const out: Record<string, unknown> = {
    Ind: true,
    PersonName: { NameNumber: email.nameNumber },
  };
  // The spec marks eTicket / Invoice / Itinerary as mutually exclusive.
  // Pick the first set flag in priority order; ignore the rest.
  if (email.eticket) {
    out.eTicket = { Ind: true };
  } else if (email.invoice) {
    out.Invoice = { Ind: true };
  } else if (email.itinerary) {
    out.Itinerary = { Ind: true };
  }
  return out;
}

type GeneratedResponse = components['schemas']['ExchangeBookingResponse'];
type GeneratedRS = NonNullable<GeneratedResponse['ExchangeBookingRS']>;
type GeneratedConfirmation = NonNullable<GeneratedRS['ExchangeConfirmation']>[number];
type GeneratedPQR = NonNullable<GeneratedRS['PriceQuoteReissue']>[number];
type GeneratedAppResults = components['schemas']['ApplicationResults'];
type GeneratedProblem = NonNullable<components['schemas']['ProblemInformation']>;
type GeneratedSystemResult = NonNullable<GeneratedProblem['SystemSpecificResults']>[number];

/**
 * Parses the `exchange` response into {@link ExchangeFlightOutput}.
 *
 * Throws {@link SabreParseError} only when the body is not valid JSON
 * or is JSON but not an object. Sabre-side application diagnostics
 * (warnings, errors) ride through on `applicationResults` — they are
 * not thrown.
 */
export function fromExchangeResponse(res: SabreResponse): ExchangeFlightOutput {
  let parsed: GeneratedResponse;
  try {
    parsed = JSON.parse(res.body) as GeneratedResponse;
  } catch (err) {
    throw new SabreParseError('Failed to parse Exchange Booking response as JSON', res.body, {
      cause: err,
    });
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SabreParseError('Exchange Booking response was not a JSON object', parsed);
  }

  const out: ExchangeFlightOutput = { rawResponse: parsed };
  const rs = parsed.ExchangeBookingRS;
  if (rs !== undefined && rs !== null && typeof rs === 'object') {
    if (rs.ApplicationResults !== undefined) {
      const ar = mapApplicationResults(rs.ApplicationResults);
      if (ar !== undefined) out.applicationResults = ar;
    }
    if (rs.ExchangeConfirmation !== undefined) {
      out.exchangeConfirmations = rs.ExchangeConfirmation.map(mapConfirmation);
    }
    if (rs.PriceQuoteReissue !== undefined) {
      out.priceQuoteReissue = rs.PriceQuoteReissue.map(mapPQR);
    }
  }

  return out;
}

function mapApplicationResults(ar: GeneratedAppResults): ExchangeApplicationResults | undefined {
  const out: ExchangeApplicationResults = {};
  if (ar.status !== undefined) out.status = ar.status;
  if (ar.Success !== undefined) out.success = ar.Success.map(mapApplicationMessage);
  if (ar.Warning !== undefined) out.warnings = ar.Warning.map(mapApplicationMessage);
  if (ar.Error !== undefined) out.errors = ar.Error.map(mapApplicationMessage);
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapApplicationMessage(p: GeneratedProblem): ExchangeApplicationMessage {
  const out: ExchangeApplicationMessage = {};
  if (p.timeStamp !== undefined) out.timeStamp = p.timeStamp;
  if (p.type !== undefined) out.type = p.type;
  if (p.SystemSpecificResults !== undefined) {
    out.systemSpecificResults = p.SystemSpecificResults.map(mapSystemSpecificResult);
  }
  return out;
}

function mapSystemSpecificResult(r: GeneratedSystemResult): ExchangeSystemSpecificResult {
  const out: ExchangeSystemSpecificResult = {};
  if (r.timeStamp !== undefined) out.timeStamp = r.timeStamp;
  if (r.ShortText !== undefined) out.shortText = r.ShortText;
  if (r.Message !== undefined) {
    out.messages = r.Message.map((m) => {
      const msg: { code?: string; value?: string } = {};
      if (m.code !== undefined) msg.code = m.code;
      if (m.content !== undefined) msg.value = m.content;
      return msg;
    });
  }
  return out;
}

function mapConfirmation(c: GeneratedConfirmation): ExchangeConfirmationResult {
  const out: ExchangeConfirmationResult = {};
  if (c.PQR_Number !== undefined) out.pqrNumber = c.PQR_Number;
  if (c.AutoRedirect !== undefined) out.autoRedirect = c.AutoRedirect;
  if (c.PriceComparison?.amountReturned !== undefined) {
    out.amountReturned = c.PriceComparison.amountReturned;
  }
  if (c.RefundableAmountOnEMD !== undefined) out.refundableAmountOnEMD = c.RefundableAmountOnEMD;
  if (c.AdditionalText !== undefined) out.additionalText = c.AdditionalText;
  return out;
}

function mapPQR(p: GeneratedPQR): ExchangePriceQuoteReissue {
  const out: ExchangePriceQuoteReissue = {};
  if (p.PQR_Number !== undefined) out.pqrNumber = p.PQR_Number;
  if (p.ResponseHeader?.Text !== undefined) out.responseHeader = p.ResponseHeader.Text;

  const misc = p.MiscInformation;
  if (misc !== undefined) {
    if (misc.BaggageFees !== undefined) {
      const lines: string[] = [];
      for (const b of misc.BaggageFees) {
        if (b.Text !== undefined) lines.push(b.Text);
      }
      if (lines.length > 0) out.baggageFees = lines;
    }
    if (misc.SignatureLine !== undefined) {
      out.signatureLines = misc.SignatureLine.map(mapSignatureLine);
    }
  }

  const priced = p.PricedItinerary;
  if (priced !== undefined) {
    if (priced.InputMessage !== undefined) out.inputMessage = priced.InputMessage;
    const info = priced.AirItineraryPricingInfo;
    if (info !== undefined) {
      if (info.ResTicketingRestrictions !== undefined) {
        out.resTicketingRestrictions = info.ResTicketingRestrictions;
      }
      if (info.FareCalculation?.Text !== undefined) {
        out.fareCalculation = info.FareCalculation.Text;
      }
      if (info.PassengerTypeQuantity !== undefined) {
        out.passengerTypeQuantities = info.PassengerTypeQuantity.map(mapPtcQuantity);
      }
      if (info.ExchangeDetails !== undefined) {
        out.exchangeDetails = mapExchangeDetails(info.ExchangeDetails);
      }
      if (info.ItinTotalFare !== undefined) {
        out.itinTotalFare = mapItinTotalFare(info.ItinTotalFare);
      }
      if (info.PTC_FareBreakdown?.FlightSegment !== undefined) {
        out.segments = info.PTC_FareBreakdown.FlightSegment.map(mapPtcFlightSegment);
      }
    }
  }

  return out;
}

function mapSignatureLine(
  s: NonNullable<NonNullable<GeneratedPQR['MiscInformation']>['SignatureLine']>[number],
): ExchangeSignatureLine {
  const out: ExchangeSignatureLine = {};
  if (s.CreationAgent !== undefined) out.creationAgent = s.CreationAgent;
  if (s.CreateDateTime !== undefined) out.createDateTime = s.CreateDateTime;
  if (s.HomePseudoCityCode !== undefined) out.homePseudoCityCode = s.HomePseudoCityCode;
  if (s.PseudoCityCode !== undefined) out.pseudoCityCode = s.PseudoCityCode;
  if (s.Source !== undefined) out.source = s.Source;
  return out;
}

type GeneratedPricingInfo = NonNullable<
  NonNullable<GeneratedPQR['PricedItinerary']>['AirItineraryPricingInfo']
>;

function mapPtcQuantity(
  q: NonNullable<GeneratedPricingInfo['PassengerTypeQuantity']>[number],
): ExchangePassengerTypeQuantity {
  const out: ExchangePassengerTypeQuantity = {};
  if (q.Code !== undefined) out.code = q.Code;
  if (q.Quantity !== undefined) out.quantity = q.Quantity;
  return out;
}

function mapExchangeDetails(
  d: NonNullable<GeneratedPricingInfo['ExchangeDetails']>,
): ExchangeDetails {
  const out: ExchangeDetails = {};
  if (d.DocNumber !== undefined) out.docNumber = d.DocNumber;
  if (d.CurrencyCode !== undefined) out.currencyCode = d.CurrencyCode;
  if (d.PQR_Status !== undefined) out.pqrStatus = d.PQR_Status;
  if (d.TicketValue !== undefined) out.ticketValue = d.TicketValue;
  if (d.PersonName?.Surname !== undefined) out.passengerName = d.PersonName.Surname;
  if (d.Text !== undefined) out.text = d.Text;
  if (d.ChangeFeeInformation !== undefined) {
    out.changeFees = d.ChangeFeeInformation.map(mapChangeFee);
  }
  if (d.TransactionInformation !== undefined) {
    out.transactionInformation = d.TransactionInformation.map(mapTransactionInfo);
  }
  return out;
}

function mapChangeFee(
  c: NonNullable<
    NonNullable<GeneratedPricingInfo['ExchangeDetails']>['ChangeFeeInformation']
  >[number],
): ExchangeChangeFee {
  const out: ExchangeChangeFee = {};
  if (c.Amount !== undefined) out.amount = c.Amount;
  // The spec example response includes a free-text `content` sibling
  // alongside `Amount` (e.g. "RESIDUAL APPLIED..."). The generated
  // type does not model it, so we don't surface it here. Callers that
  // need it can reach into `rawResponse`.
  return out;
}

function mapTransactionInfo(
  t: NonNullable<
    NonNullable<GeneratedPricingInfo['ExchangeDetails']>['TransactionInformation']
  >[number],
): ExchangeTransactionInformation {
  const out: ExchangeTransactionInformation = {};
  if (t.Amount !== undefined) out.amount = t.Amount;
  if (t.CurrencyCode !== undefined) out.currencyCode = t.CurrencyCode;
  if (t.Text !== undefined) out.text = t.Text;
  return out;
}

function mapItinTotalFare(
  f: NonNullable<GeneratedPricingInfo['ItinTotalFare']>,
): ExchangeItinTotalFare {
  const out: ExchangeItinTotalFare = {};
  if (f.BaseFare !== undefined) out.baseFare = mapMoney(f.BaseFare);
  if (f.TotalFare !== undefined) out.totalFare = mapMoney(f.TotalFare);
  if (f.Taxes !== undefined) out.taxes = mapTaxes(f.Taxes);
  return out;
}

function mapMoney(m: { Amount?: string; CurrencyCode?: string }): ExchangeMoney {
  const out: ExchangeMoney = {};
  if (m.Amount !== undefined) out.amount = m.Amount;
  if (m.CurrencyCode !== undefined) out.currencyCode = m.CurrencyCode;
  return out;
}

function mapTaxes(
  t: NonNullable<NonNullable<GeneratedPricingInfo['ItinTotalFare']>['Taxes']>,
): ExchangeTaxes {
  const out: ExchangeTaxes = {};
  if (t.TaxCode !== undefined) out.taxCode = t.TaxCode;
  if (t.TotalAmount !== undefined) out.totalAmount = t.TotalAmount;
  if (t.Tax !== undefined) {
    out.tax = t.Tax.map((line) => {
      const tl: ExchangeTaxLine = {};
      if (line.Amount !== undefined) tl.amount = line.Amount;
      if (line.TaxCode !== undefined) tl.taxCode = line.TaxCode;
      return tl;
    });
  }
  return out;
}

function mapPtcFlightSegment(
  seg: NonNullable<
    NonNullable<NonNullable<GeneratedPricingInfo['PTC_FareBreakdown']>['FlightSegment']>
  >[number],
): ExchangePtcFlightSegment {
  const out: ExchangePtcFlightSegment = {};
  if (seg.ConnectionInd !== undefined) out.connectionInd = seg.ConnectionInd;
  if (seg.DepartureDateTime !== undefined) out.departureDateTime = seg.DepartureDateTime;
  if (seg.FlightNumber !== undefined) out.flightNumber = seg.FlightNumber;
  if (seg.ResBookDesigCode !== undefined) out.bookingClass = seg.ResBookDesigCode;
  if (seg.RPH !== undefined) out.rph = seg.RPH;
  if (seg.BaggageAllowance?.Number !== undefined) {
    out.baggageAllowance = seg.BaggageAllowance.Number;
  }
  if (seg.FareBasis?.Code !== undefined) out.fareBasis = seg.FareBasis.Code;
  if (seg.MarketingAirline?.Code !== undefined) {
    out.marketingCarrier = seg.MarketingAirline.Code;
  }
  if (seg.MarketingAirline?.FlightNumber !== undefined) {
    out.marketingFlightNumber = seg.MarketingAirline.FlightNumber;
  }
  if (seg.OriginLocation?.LocationCode !== undefined) {
    out.origin = seg.OriginLocation.LocationCode;
  }
  if (seg.ValidityDates?.NotValidBefore !== undefined) {
    out.notValidBefore = seg.ValidityDates.NotValidBefore;
  }
  if (seg.ValidityDates?.NotValidAfter !== undefined) {
    out.notValidAfter = seg.ValidityDates.NotValidAfter;
  }
  return out;
}
