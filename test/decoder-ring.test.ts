// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyEvent } from 'aws-lambda';
import jsonwebtoken from 'jsonwebtoken';
import { JwksClient, RsaSigningKey, SigningKey } from 'jwks-rsa';
import * as decoder from '../src/decoder-ring';


describe('Decoder Ring', () => {
  describe('getSigningKey', () => {
    test('success', async () => {
      const expectedResult = 'success';
      const client = {
        getSigningKey(_kid: string, callback: (err: Error | null, value: SigningKey) => void) {
          callback(null, (expectedResult as unknown) as SigningKey);
        },
      } as JwksClient;

      const result = await decoder.getSigningKey(client, '123');
      expect(result).toBe(expectedResult);
    });

    test('failure', async () => {
      expect.assertions(1);
      const error = new Error('Failure');
      const client = {
        getSigningKey(_kid: string, callback: (error: Error) => void) {
          callback(error);
        },
      } as JwksClient;

      try {
        await decoder.getSigningKey(client, '123');
      } catch (err) {
        expect(error).toBe(err);
      }
    });
  });

  describe('verifyToken', () => {
    const token = 'should-be-mocked';
    test('no key id', async () => {
      expect.assertions(1);
      try {
        await decoder.verifyToken({} as JwksClient, token);
      } catch (err) {
        expect(err.message).toBe('Token has no Key ID');
      }
    });

    const mockGetPublicKey = (publicKey = '') => {
      jest.spyOn(decoder, 'getSigningKey').mockResolvedValueOnce({
        getPublicKey() {
          return publicKey;
        },
      } as RsaSigningKey);
    };

    const mockDecode = (mockValue: { [key: string]: any }) => {
      jest.spyOn(jsonwebtoken, 'decode').mockReturnValueOnce(mockValue as never);
    };

    test('no public or RSA key', async () => {
      expect.assertions(1);
      mockDecode({ header: { kid: 'mockKid' } });
      mockGetPublicKey();

      try {
        await decoder.verifyToken({} as JwksClient, token);
      } catch (err) {
        expect(err.message).toBe('Unauthorized');
      }
    });

    test('successful verification', async () => {
      mockDecode({ header: { kid: 'mockKid' } });
      mockGetPublicKey('truthy');
      const mockValue = 'asdf';
      jest.spyOn(jsonwebtoken, 'verify').mockReturnValueOnce(({ mockValue } as unknown) as void); // jest picks one of the implementations that returns void
      const verifiedToken: { mockValue: string } = await decoder.verifyToken({} as JwksClient, token) as { mockValue: string };
      expect(verifiedToken).toBeTruthy();
      expect(verifiedToken.mockValue).toBe(mockValue);
    });
  });

  test('decode token', async () => {
    const decoded = { payload: 'Good Payload' };
    jest.spyOn(decoder, 'verifyToken').mockResolvedValueOnce(decoded);
    const res = await decoder.handler({ body: JSON.stringify({ token: 'token' }) } as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(JSON.stringify(decoded));
  });

  test('decode error', async () => {
    const err = 'decode error';
    jest.spyOn(decoder, 'verifyToken').mockRejectedValue(new Error(err));
    const res = await decoder.handler({ body: JSON.stringify({ token: 'token' }) } as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe(err);
  });

  test('no body', async () => {
    const res = await decoder.handler({} as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe('Bad Payload');
  });
});