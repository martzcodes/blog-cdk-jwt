import { JWK as actualJWK } from 'node-jose';

export const mockJose = jest.fn();

const JWK = {
  asKey: mockJose,
  createKeyStore: actualJWK.createKeyStore,
};

const JWS = {
  createSign: jest.fn().mockImplementation(() => ({
    update: jest.fn().mockImplementation(() => ({
      final: mockJose,
    })),
  })),
};

export { JWK, JWS };