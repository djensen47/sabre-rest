import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromGetDetailsResponse, toGetDetailsRequest } from './mappers.js';
import type { GetHotelDetailsInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

function hotelRefInput(
  overrides: Partial<Extract<GetHotelDetailsInput, { kind: 'hotel-ref' }>> = {},
): GetHotelDetailsInput {
  return {
    kind: 'hotel-ref',
    hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
    rateCriteria: {
      stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
      rooms: [{ index: 1, adults: 2 }],
    },
    ...overrides,
  };
}

function rateKeyInput(
  overrides: Partial<Extract<GetHotelDetailsInput, { kind: 'rate-key' }>> = {},
): GetHotelDetailsInput {
  return {
    kind: 'rate-key',
    rateKey: 'OPAQUE-RATE-KEY==',
    ...overrides,
  };
}

describe('toGetDetailsRequest — hotel-ref flow', () => {
  it('builds a POST with the minimum body', () => {
    const req = toGetDetailsRequest(BASE, hotelRefInput());

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hoteldetails');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelDetailsRQ: {
        version: '5.1.0',
        SearchCriteria: {
          HotelRefs: { HotelRef: { HotelCode: '100072188', CodeContext: 'GLOBAL' } },
          RateInfoRef: {
            StayDateTimeRange: { StartDate: '2026-06-20', EndDate: '2026-06-22' },
            Rooms: { Room: [{ Index: 1, Adults: 2 }] },
          },
        },
      },
    });
  });

  it('handles a trailing-slash base URL without duplicating it', () => {
    const req = toGetDetailsRequest(`${BASE}/`, hotelRefInput());
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v5/get/hoteldetails');
  });

  it('omits optional codeContext when not supplied', () => {
    const req = toGetDetailsRequest(BASE, hotelRefInput({ hotelRef: { code: '8315' } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelDetailsRQ.SearchCriteria.HotelRefs.HotelRef).toEqual({
      HotelCode: '8315',
    });
  });

  it('attaches POS and corporateNumber at the request root when supplied', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        pointOfSale: { pseudoCityCode: 'TM61' },
        corporateNumber: 'DK44391RC',
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelDetailsRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
    expect(body.GetHotelDetailsRQ.CorporateNumber).toBe('DK44391RC');
  });

  it('joins childAges with commas on the wire', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2, children: 3, childAges: [10, 11, 12] }],
        },
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelDetailsRQ.SearchCriteria.RateInfoRef.Rooms.Room[0]).toEqual({
      Index: 1,
      Adults: 2,
      Children: 3,
      ChildAges: '10,11,12',
    });
  });

  it('joins rateSource array with commas', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2 }],
          rateSource: ['100', '112', '110'],
        },
      }),
    );
    expect(JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria.RateInfoRef.RateSource).toBe(
      '100,112,110',
    );
  });

  it('emits a full rate criteria body when supplied', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        rateCriteria: {
          stayDateTimeRange: { startDate: '2026-06-20', endDate: '2026-06-22' },
          rooms: [{ index: 1, adults: 2 }],
          currencyCode: 'USD',
          prepaidQualifier: 'IncludePrepaid',
          refundableOnly: true,
          convertedRateInfoOnly: true,
          travellerCountry: 'IN',
          rateRange: { min: 100, max: 500 },
          ratePlanCandidates: {
            exactMatchOnly: false,
            candidates: [{ ratePlanType: '11', ratePlanCode: 'ABC' }],
          },
          loyaltyIds: ['YX1123'],
          rateFilters: [{ type: 'Commission', value: 'NC', action: 'Exclude' }],
          sortOrder: 'ASC',
          sortBy: 'AverageNightlyRateBeforeTax',
        },
      }),
    );
    const rir = JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria.RateInfoRef;
    expect(rir).toMatchObject({
      CurrencyCode: 'USD',
      PrepaidQualifier: 'IncludePrepaid',
      RefundableOnly: true,
      ConvertedRateInfoOnly: true,
      TravellerCountry: 'IN',
      RateRange: { Min: 100, Max: 500 },
      RatePlanCandidates: {
        ExactMatchOnly: false,
        RatePlanCandidate: [{ RatePlanType: '11', RatePlanCode: 'ABC' }],
      },
      LoyaltyIds: { LoyaltyId: ['YX1123'] },
      RateFilters: { RateFilter: [{ Type: 'Commission', Value: 'NC', Action: 'Exclude' }] },
      SortOrder: 'ASC',
      SortBy: 'AverageNightlyRateBeforeTax',
    });
  });

  it('emits HotelContentRef when descriptive content is requested', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        contentRef: {
          descriptiveInfo: {
            propertyInfo: true,
            locationInfo: true,
            amenities: true,
            descriptions: ['ShortDescription', 'Dining'],
          },
          media: {
            images: ['ORIGINAL', 'THUMBNAIL'],
            categories: [3, 5],
            languages: ['EN'],
          },
        },
      }),
    );
    const sc = JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria;
    expect(sc.HotelContentRef).toEqual({
      DescriptiveInfoRef: {
        PropertyInfo: true,
        LocationInfo: true,
        Amenities: true,
        Descriptions: { Description: [{ Type: 'ShortDescription' }, { Type: 'Dining' }] },
      },
      MediaRef: {
        MediaTypes: { Images: { Image: [{ Type: 'ORIGINAL' }, { Type: 'THUMBNAIL' }] } },
        Categories: { Category: [{ Code: 3 }, { Code: 5 }] },
        Languages: { Language: [{ Code: 'EN' }] },
      },
    });
  });

  it('nests Images, PanoramicMedias, and Videos under MediaTypes (not a MediaType selector)', () => {
    const req = toGetDetailsRequest(
      BASE,
      hotelRefInput({
        contentRef: {
          media: {
            maxItems: '10',
            images: ['MEDIUM'],
            panoramicMedias: ['HD360'],
            videos: ['VIDEO360'],
          },
        },
      }),
    );
    const sc = JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria;
    expect(sc.HotelContentRef.MediaRef).toEqual({
      MaxItems: '10',
      MediaTypes: {
        Images: { Image: [{ Type: 'MEDIUM' }] },
        PanoramicMedias: { PanoramicMedia: [{ Type: 'HD360' }] },
        Videos: { Video: [{ Type: 'VIDEO360' }] },
      },
    });
  });

  it('emits ShopKey at the SearchCriteria level when supplied', () => {
    const req = toGetDetailsRequest(BASE, hotelRefInput({ shopKey: 'SHOP-KEY==' }));
    const sc = JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria;
    expect(sc.ShopKey).toBe('SHOP-KEY==');
  });
});

describe('toGetDetailsRequest — rate-key flow', () => {
  it('builds a POST with only the rate key', () => {
    const req = toGetDetailsRequest(BASE, rateKeyInput());
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelDetailsRQ: {
        version: '5.1.0',
        SearchCriteria: { RateKeyRef: { RateKey: 'OPAQUE-RATE-KEY==' } },
      },
    });
  });

  it('does not emit HotelRefs or RateInfoRef on the rate-key flow', () => {
    const req = toGetDetailsRequest(BASE, rateKeyInput());
    const sc = JSON.parse(req.body ?? '').GetHotelDetailsRQ.SearchCriteria;
    expect(sc.HotelRefs).toBeUndefined();
    expect(sc.RateInfoRef).toBeUndefined();
  });

  it('passes through all optional refinement fields', () => {
    const req = toGetDetailsRequest(
      BASE,
      rateKeyInput({
        pointOfSale: { pseudoCityCode: 'TM61' },
        prepaidQualifier: 'PrepaidOnly',
        refundableOnly: true,
        convertedRateInfoOnly: false,
        exactMatchOnly: true,
        travellerCountry: 'US',
        shopKey: 'SHOP-KEY==',
        rateRange: { min: 50 },
        roomSetTypes: ['RoomView', 'RoomType'],
        rateSource: ['100', '112'],
        rateFilters: [{ type: 'RateType', value: 'CORP', action: 'Include' }],
        sortOrder: 'DESC',
        sortBy: 'PrepaidRates',
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelDetailsRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
    expect(body.GetHotelDetailsRQ.SearchCriteria.RateKeyRef).toEqual({
      RateKey: 'OPAQUE-RATE-KEY==',
      PrepaidQualifier: 'PrepaidOnly',
      RefundableOnly: true,
      ConvertedRateInfoOnly: false,
      ExactMatchOnly: true,
      TravellerCountry: 'US',
      ShopKey: 'SHOP-KEY==',
      RateRange: { Min: 50 },
      RoomSetTypes: { RoomSet: [{ Type: 'RoomView' }, { Type: 'RoomType' }] },
      RateSource: '100,112',
      RateFilter: [{ Type: 'RateType', Value: 'CORP', Action: 'Include' }],
      SortOrder: 'DESC',
      SortBy: 'PrepaidRates',
    });
    expect(body.GetHotelDetailsRQ.SearchCriteria.ShopKey).toBe('SHOP-KEY==');
  });
});

describe('fromGetDetailsResponse', () => {
  it('maps a populated ResponseWithRooms body with descriptive info and media', () => {
    const out = fromGetDetailsResponse(
      okResponse({
        GetHotelDetailsRS: {
          ApplicationResults: { status: 'Complete' },
          HotelDetailsInfo: {
            HotelInfo: {
              HotelCode: '100072188',
              CodeContext: 'GLOBAL',
              SabreHotelCode: '8315',
              HotelName: 'Hyatt Regency Tulsa',
              ChainCode: 'HY',
              ChainName: 'Hyatt Hotels And Resorts',
              Status: 'Active',
            },
            HotelRateInfo: {
              RateInfos: {
                ShopKey: 'SHOP==',
                ConvertedRateInfo: [
                  {
                    AmountAfterTax: '136.66',
                    CurrencyCode: 'USD',
                    RateSource: '110',
                    RateKey: 'RATEKEY-CONV==',
                    ApproxTotalPrice: '150.00',
                    HighestNightlyRate: '80.00',
                  },
                ],
                RateInfo: [
                  {
                    AmountAfterTax: '110.50',
                    CurrencyCode: 'USD',
                    RateSource: '100',
                    RateKey: 'RATEKEY-NATIVE==',
                    ApproxTotalPrice: '120.00',
                    HighestNightlyRate: '65.00',
                  },
                ],
              },
              Rooms: {
                Room: [
                  {
                    RoomIndex: 1,
                    RoomType: 'Suite',
                    NumberOfBedRooms: 2,
                    AccessibleAmenities: {
                      Amenity: [{ Code: 7, Description: 'Roll-in shower' }],
                    },
                    RoomMediaInfo: {
                      MediaItems: {
                        MediaItem: [{ Id: 'ROOM-1', Format: 'JPG' }],
                      },
                    },
                    RatePlans: {
                      RatePlan: [
                        {
                          PrepaidIndicator: false,
                          RateSource: '100',
                          RateKey: 'RATEPLAN-KEY==',
                          RatePlanName: 'Single Bed Room',
                        },
                      ],
                    },
                  },
                ],
              },
            },
            HotelDescriptiveInfo: {
              PropertyInfo: { Floors: '12', Rooms: '118' },
              LocationInfo: {
                Latitude: 36.15,
                Longitude: -95.99,
                Address: {
                  AddressLine1: '100 E Second St',
                  CityName: { CityCode: 'TUL', value: 'Tulsa' },
                  StateProv: { StateCode: 'OK', value: 'Oklahoma' },
                  PostalCode: '74103',
                  CountryName: { Code: 'US', value: 'United States' },
                },
                Contact: { Phone: '918-234-1234' },
              },
              Amenities: { Amenity: [{ Code: 15, Description: 'Car rental desk' }] },
              Sustainability: {
                EnvironmentalImpact: {
                  CarbonFootprint: { RoomNight: '1', CarbonUOM: 'kgCO2' },
                },
              },
              Descriptions: {
                Description: [
                  { Text: { Type: 'ShortDescription', value: 'A great hotel.' } },
                  { Text: { Type: 'Dining' } },
                ],
              },
            },
            HotelMediaInfo: {
              MediaItems: {
                MediaItem: [
                  {
                    Id: '1377631',
                    Ordinal: 2,
                    LastModifedDate: '2024-06-28',
                    Format: 'JPG',
                    Category: {
                      CategoryCode: 3,
                      Description: {
                        Text: [{ Language: 'EN', value: 'Exterior view' }],
                      },
                    },
                    ImageItems: {
                      Image: [
                        {
                          Url: 'https://example.com/image.jpg',
                          Type: 'MEDIUM',
                          Height: 480,
                          Width: 640,
                        },
                      ],
                    },
                    AdditionalInfo: {
                      Info: [
                        {
                          Type: 'CAPTION',
                          Description: { Text: [{ Language: 'en', value: 'Guestroom' }] },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.status).toBe('Complete');
    expect(out.hotel?.info).toEqual({
      code: '100072188',
      codeContext: 'GLOBAL',
      sabreCode: '8315',
      hotelName: 'Hyatt Regency Tulsa',
      chainCode: 'HY',
      chainName: 'Hyatt Hotels And Resorts',
      status: 'Active',
    });
    expect(out.hotel?.rateInfos?.shopKey).toBe('SHOP==');
    expect(out.hotel?.rateInfos?.rateInfo?.[0]?.rateKey).toBe('RATEKEY-NATIVE==');
    expect(out.hotel?.rateInfos?.rateInfo?.[0]).toMatchObject({
      approxTotalPrice: '120.00',
      highestNightlyRate: '65.00',
    });
    expect(out.hotel?.rateInfos?.convertedRateInfo?.[0]?.rateKey).toBe('RATEKEY-CONV==');
    expect(out.hotel?.rateInfos?.convertedRateInfo?.[0]).toMatchObject({
      approxTotalPrice: '150.00',
      highestNightlyRate: '80.00',
    });
    expect(out.hotel?.rooms?.[0]?.ratePlans?.[0]?.rateKey).toBe('RATEPLAN-KEY==');
    expect(out.hotel?.rooms?.[0]).toMatchObject({
      numberOfBedRooms: 2,
      accessibleAmenities: [{ code: 7, description: 'Roll-in shower' }],
      roomMediaInfo: { items: [{ id: 'ROOM-1', format: 'JPG' }] },
    });
    expect(out.hotel?.descriptiveInfo?.propertyInfo).toEqual({ floors: '12', rooms: '118' });
    expect(out.hotel?.descriptiveInfo?.locationInfo?.latitude).toBe(36.15);
    expect(out.hotel?.descriptiveInfo?.locationInfo?.address?.postalCode).toBe('74103');
    expect(out.hotel?.descriptiveInfo?.amenities).toEqual([
      { code: 15, description: 'Car rental desk' },
    ]);
    expect(out.hotel?.descriptiveInfo?.sustainability?.environmentalImpact).toEqual({
      CarbonFootprint: { RoomNight: '1', CarbonUOM: 'kgCO2' },
    });
    expect(out.hotel?.descriptiveInfo?.descriptions).toEqual([
      { type: 'ShortDescription', text: ['A great hotel.'] },
      { type: 'Dining' },
    ]);
    expect(out.hotel?.mediaInfo?.items).toHaveLength(1);
    expect(out.hotel?.mediaInfo?.items?.[0]).toMatchObject({
      id: '1377631',
      ordinal: 2,
      type: 'IMAGE',
      format: 'JPG',
      caption: 'Guestroom',
      category: { code: 3, description: 'Exterior view' },
    });
    expect(out.hotel?.mediaInfo?.items?.[0]?.images).toEqual([
      { url: 'https://example.com/image.jpg', size: 'MEDIUM', height: 480, width: 640 },
    ]);
    expect(out.hotel?.roomSets).toBeUndefined();
  });

  it('maps a populated ResponseWithRoomSets body', () => {
    const out = fromGetDetailsResponse(
      okResponse({
        GetHotelDetailsRS: {
          HotelDetailsInfo: {
            HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
            HotelRateInfo: {
              RateInfos: {},
              RoomSets: {
                RoomSet: [
                  {
                    RoomSetAttributes: {
                      RoomSetAttribute: [{ Type: 'RoomType', Code: 3, Value: 'Suite' }],
                    },
                    Room: [
                      {
                        RoomIndex: 1,
                        RatePlans: {
                          RatePlan: [
                            {
                              PrepaidIndicator: true,
                              RateSource: '112',
                              RateKey: 'RPKEY==',
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.hotel?.roomSets).toHaveLength(1);
    expect(out.hotel?.roomSets?.[0]?.attributes).toEqual([
      { type: 'RoomType', code: 3, value: 'Suite' },
    ]);
    expect(out.hotel?.roomSets?.[0]?.rooms?.[0]?.ratePlans?.[0]?.rateKey).toBe('RPKEY==');
    expect(out.hotel?.rooms).toBeUndefined();
  });

  it('maps alternate hotels and rate unavailability', () => {
    const out = fromGetDetailsResponse(
      okResponse({
        GetHotelDetailsRS: {
          HotelDetailsInfo: {
            HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
            AlternateHotelInfos: {
              AlternateHotelInfo: [
                {
                  HotelInfo: {
                    HotelCode: '100097634',
                    CodeContext: 'GLOBAL',
                    ChainCode: 'MC',
                  },
                  HotelImageInfo: {
                    ImageItem: {
                      Id: 'ALT-IMG-1',
                      Format: 'JPG',
                      LastModifiedDate: '2024-06-28',
                      Category: [{ Code: 3 }, { Code: 5 }],
                      Ordinal: 1,
                    },
                  },
                },
              ],
            },
            HotelRateInfo: {
              RateInfos: {},
              RateUnavailability: {
                RateSource: [
                  { Source: '110', Reason: 'timeout' },
                  { Source: '112', Reason: 'no-avail', DisplayMessage: 'no rooms' },
                ],
              },
            },
          },
        },
      }),
    );

    expect(out.hotel?.alternateHotels).toEqual([
      {
        info: { code: '100097634', codeContext: 'GLOBAL', chainCode: 'MC' },
        image: {
          id: 'ALT-IMG-1',
          format: 'JPG',
          lastModifiedDate: '2024-06-28',
          categoryCodes: [3, 5],
          ordinal: 1,
        },
      },
    ]);
    expect(out.hotel?.rateUnavailability).toEqual([
      { source: '110', reason: 'timeout' },
      { source: '112', reason: 'no-avail', displayMessage: 'no rooms' },
    ]);
  });

  it('surfaces a translated-content block when present', () => {
    const out = fromGetDetailsResponse(
      okResponse({
        GetHotelDetailsRS: {
          HotelDetailsInfo: {
            HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' },
          },
          TranslatedDetailsInfo: {
            LanguageCode: 'es',
            HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL', HotelName: 'Hotel Madrid' },
          },
        },
      }),
    );

    expect(out.translated).toEqual({
      languageCode: 'es',
      info: { code: 'A', codeContext: 'GLOBAL', hotelName: 'Hotel Madrid' },
    });
  });

  it('returns an empty output envelope when GetHotelDetailsRS is empty', () => {
    const out = fromGetDetailsResponse(okResponse({ GetHotelDetailsRS: {} }));
    expect(out).toEqual({});
  });

  it('throws SabreParseError on non-JSON body', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    try {
      fromGetDetailsResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when body is JSON but not an object', () => {
    expect(() => fromGetDetailsResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when GetHotelDetailsRS is missing', () => {
    expect(() => fromGetDetailsResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
