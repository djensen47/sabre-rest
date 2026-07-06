import { describe, expect, it } from 'vitest';
import { SabreParseError } from '../../errors/sabre-parse-error.js';
import { okResponse } from '../../http/test-utils.js';
import type { SabreResponse } from '../../http/types.js';
import { fromGetContentResponse, toGetContentRequest } from './mappers.js';
import type { GetHotelContentInput } from './types.js';

const BASE = 'https://api.cert.platform.sabre.com';

function baseInput(overrides: Partial<GetHotelContentInput> = {}): GetHotelContentInput {
  return {
    hotelRef: { code: '100072188', codeContext: 'GLOBAL' },
    ...overrides,
  };
}

describe('toGetContentRequest', () => {
  it('builds a POST with the minimum body', () => {
    const req = toGetContentRequest(BASE, baseInput());

    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v4.0.0/get/hotelcontent');
    expect(req.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(req.body ?? '')).toEqual({
      GetHotelContentRQ: {
        SearchCriteria: {
          HotelRefs: { HotelRef: { HotelCode: '100072188', CodeContext: 'GLOBAL' } },
        },
      },
    });
  });

  it('handles a trailing-slash base URL without duplicating it', () => {
    const req = toGetContentRequest(`${BASE}/`, baseInput());
    expect(req.url).toBe('https://api.cert.platform.sabre.com/v4.0.0/get/hotelcontent');
  });

  it('omits optional codeContext when not supplied', () => {
    const req = toGetContentRequest(BASE, baseInput({ hotelRef: { code: '8315' } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.HotelRefs.HotelRef).toEqual({
      HotelCode: '8315',
    });
  });

  it('attaches POS when supplied', () => {
    const req = toGetContentRequest(BASE, baseInput({ pointOfSale: { pseudoCityCode: 'TM61' } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.POS).toEqual({ Source: { PseudoCityCode: 'TM61' } });
  });

  it('omits documented defaults when the consumer does not supply them', () => {
    const req = toGetContentRequest(BASE, baseInput({ descriptiveInfo: {}, media: {} }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.DescriptiveInfoRef).toBeUndefined();
    expect(body.GetHotelContentRQ.SearchCriteria.MediaRef).toBeUndefined();
  });

  it('omits DescriptiveInfoRef flags not supplied while including those that are', () => {
    const req = toGetContentRequest(
      BASE,
      baseInput({ descriptiveInfo: { propertyInfo: true, amenities: false } }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.DescriptiveInfoRef).toEqual({
      PropertyInfo: true,
      Amenities: false,
    });
  });

  it('builds Descriptions from the descriptions list', () => {
    const req = toGetContentRequest(
      BASE,
      baseInput({ descriptiveInfo: { descriptions: ['Dining', 'Facilities'] } }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.DescriptiveInfoRef.Descriptions).toEqual({
      Description: [{ Type: 'Dining' }, { Type: 'Facilities' }],
    });
  });

  it('omits Descriptions when the array is empty', () => {
    const req = toGetContentRequest(BASE, baseInput({ descriptiveInfo: { descriptions: [] } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.DescriptiveInfoRef).toBeUndefined();
  });

  it('nests Images/PanoramicMedias/Videos inside MediaTypes', () => {
    const req = toGetContentRequest(
      BASE,
      baseInput({
        media: {
          images: ['MEDIUM', 'LARGE'],
          panoramicMedias: ['HD360'],
          videos: ['VIDEO360'],
        },
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.MediaRef.MediaTypes).toEqual({
      Images: { Image: [{ Type: 'MEDIUM' }, { Type: 'LARGE' }] },
      PanoramicMedias: { PanoramicMedia: [{ Type: 'HD360' }] },
      Videos: { Video: [{ Type: 'VIDEO360' }] },
    });
  });

  it('omits empty media-type arrays', () => {
    const req = toGetContentRequest(BASE, baseInput({ media: { images: [] } }));
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.MediaRef).toBeUndefined();
  });

  it('builds AdditionalInfo as type+value flag pairs', () => {
    const req = toGetContentRequest(
      BASE,
      baseInput({
        media: {
          additionalInfo: [
            { type: 'CAPTION', value: true },
            { type: 'ROOM_TYPE_CODE', value: false },
          ],
        },
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.MediaRef.AdditionalInfo).toEqual({
      Info: [
        { Type: 'CAPTION', value: true },
        { Type: 'ROOM_TYPE_CODE', value: false },
      ],
    });
  });

  it('builds a full media request with all fields', () => {
    const req = toGetContentRequest(
      BASE,
      baseInput({
        media: {
          maxItems: '10',
          images: ['MEDIUM'],
          categories: [1, 2],
          roomTypeCodes: ['A1K'],
          languages: ['EN', 'FR'],
        },
      }),
    );
    const body = JSON.parse(req.body ?? '');
    expect(body.GetHotelContentRQ.SearchCriteria.MediaRef).toEqual({
      MaxItems: '10',
      MediaTypes: { Images: { Image: [{ Type: 'MEDIUM' }] } },
      Categories: { Category: [{ Code: 1 }, { Code: 2 }] },
      RoomTypeCodes: { RoomTypeCode: [{ Code: 'A1K' }] },
      Languages: { Language: [{ Code: 'EN' }, { Code: 'FR' }] },
    });
  });
});

describe('fromGetContentResponse', () => {
  it('maps a populated hotel content body', () => {
    const out = fromGetContentResponse(
      okResponse({
        GetHotelContentRS: {
          ApplicationResults: { status: 'Complete' },
          HotelContentInfos: {
            HotelContentInfo: {
              HotelInfo: {
                HotelCode: '100072188',
                CodeContext: 'GLOBAL',
                SabreHotelCode: '8315',
                HotelName: 'Hyatt Regency Tulsa',
                ChainCode: 'HY',
              },
              HotelDescriptiveInfo: {
                PropertyInfo: { Floors: '3', Rooms: '118' },
                LocationInfo: {
                  Latitude: 36.1548,
                  Longitude: -95.990356,
                  Address: {
                    AddressLine1: '50 N MARTINGALE RD',
                    CityName: { CityCode: 'TUL', value: 'Tulsa' },
                    PostalCode: '60173',
                    CountryName: { Code: 'US', value: 'United States' },
                  },
                },
                Amenities: { Amenity: [{ Code: 15, Description: 'Car rental desk' }] },
                Descriptions: {
                  Description: [{ Text: { Type: 'Dining', value: 'Bluefire Grill' } }],
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
                      ImageItems: {
                        Image: [{ Url: 'http://img', Type: 'THUMBNAIL', Height: 100, Width: 150 }],
                      },
                      Category: {
                        CategoryCode: 3,
                        Description: { Text: [{ Language: 'en', value: 'Exterior view' }] },
                      },
                    },
                  ],
                },
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
    });
    expect(out.hotel?.descriptiveInfo?.propertyInfo).toEqual({ floors: '3', rooms: '118' });
    expect(out.hotel?.descriptiveInfo?.locationInfo?.address).toEqual({
      addressLine1: '50 N MARTINGALE RD',
      city: { cityCode: 'TUL', value: 'Tulsa' },
      postalCode: '60173',
      country: { code: 'US', value: 'United States' },
    });
    expect(out.hotel?.descriptiveInfo?.amenities).toEqual([
      { code: 15, description: 'Car rental desk' },
    ]);
    expect(out.hotel?.descriptiveInfo?.descriptions).toEqual([
      { type: 'Dining', text: 'Bluefire Grill' },
    ]);
    expect(out.hotel?.mediaInfo?.items).toHaveLength(1);
    expect(out.hotel?.mediaInfo?.items?.[0]).toEqual({
      id: '1377631',
      ordinal: 2,
      lastModifiedDate: '2024-06-28',
      format: 'JPG',
      images: [{ url: 'http://img', size: 'THUMBNAIL', height: 100, width: 150 }],
      category: { code: 3, description: [{ language: 'en', value: 'Exterior view' }] },
    });
  });

  it('returns an empty output envelope when GetHotelContentRS is empty', () => {
    const out = fromGetContentResponse(okResponse({ GetHotelContentRS: {} }));
    expect(out).toEqual({});
  });

  it('omits mediaInfo when HotelMediaInfo is absent', () => {
    const out = fromGetContentResponse(
      okResponse({
        GetHotelContentRS: {
          HotelContentInfos: {
            HotelContentInfo: { HotelInfo: { HotelCode: 'A', CodeContext: 'GLOBAL' } },
          },
        },
      }),
    );
    expect(out.hotel?.mediaInfo).toBeUndefined();
    expect(out.hotel?.descriptiveInfo).toBeUndefined();
  });

  it('throws SabreParseError on non-JSON body', () => {
    const res: SabreResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '<html>not json</html>',
    };
    try {
      fromGetContentResponse(res);
      expect.fail('expected SabreParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(SabreParseError);
      expect((err as SabreParseError).responseBody).toBe('<html>not json</html>');
    }
  });

  it('throws SabreParseError when body is JSON but not an object', () => {
    expect(() => fromGetContentResponse(okResponse(null))).toThrow(SabreParseError);
  });

  it('throws SabreParseError when GetHotelContentRS is missing', () => {
    expect(() => fromGetContentResponse(okResponse({}))).toThrow(SabreParseError);
  });
});
