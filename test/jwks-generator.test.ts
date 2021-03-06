import S3 from '../src/__mocks__/aws-sdk/clients/s3';
import SecretsManager, { mockSMResponse } from '../src/__mocks__/aws-sdk/clients/secretsmanager';
import { handler } from '../src/jwks-generator';

const s3 = new S3();
const sm = new SecretsManager();

describe('JwksGenerator', () => {
  test('generate jwks', async () => {
    await handler();
    expect(sm.putSecretValue).toHaveBeenCalledTimes(1);
    expect(s3.putObject).toHaveBeenCalledTimes(1);
    const putSecretValue = sm.putSecretValue.mock.calls[0][0];
    expect(putSecretValue).toMatchSnapshot({
      SecretString: expect.any(String),
    });
    const secretValue = JSON.parse(putSecretValue.SecretString);
    expect(secretValue).toMatchSnapshot({
      kty: 'RSA',
      kid: expect.any(String),
      use: 'sig',
      alg: 'RS256',
      e: expect.any(String),
      n: expect.any(String),
      d: expect.any(String),
      p: expect.any(String),
      q: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      qi: expect.any(String),
    });

    const putObject = s3.putObject.mock.calls[0][0];
    expect(putObject).toMatchSnapshot({
      Body: expect.any(String),
    });
    const body = JSON.parse(putObject.Body);
    expect(body).toMatchSnapshot({
      kty: 'RSA',
      kid: expect.any(String),
      use: 'sig',
      alg: 'RS256',
      e: expect.any(String),
      n: expect.any(String),
    });
  });
  test('generate jwks error', async () => {
    const errorMessage = 'some error';
    mockSMResponse.mockRejectedValue(new Error(errorMessage));
    expect.assertions(1);
    try {
      await handler();
    } catch (e) {
      console.log(e);
      expect(e.message).toBe(errorMessage);
    }
  });
});