export const mockSMResponse = jest.fn().mockReturnValue(new Promise((resolve) => resolve(true)));

const mockPutSecretValue = jest.fn().mockImplementation(() => ({ promise: mockSMResponse }));
const mockGetSecretValue = jest.fn().mockImplementation(() => ({ promise: mockSMResponse }));

export default class SecretsManager {
  getSecretValue = mockGetSecretValue;
  putSecretValue = mockPutSecretValue;
}
