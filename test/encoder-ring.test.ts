// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyEvent } from 'aws-lambda';
import SecretsManager, { mockSMResponse } from '../src/__mocks__/aws-sdk/clients/secretsmanager';
import { mockJose } from '../src/__mocks__/node-jose';
import { handler } from '../src/encoder-ring';

const sm = new SecretsManager();

describe('Encoder Ring', () => {
  test('generate jwt', async () => {
    mockSMResponse.mockReturnValue({ SecretString: '{}' });

    const fakeToken = 'fake token';

    mockJose.mockReturnValue(fakeToken);
    const res = await handler({ body: '{}' } as APIGatewayProxyEvent);
    expect(sm.getSecretValue).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(mockJose).toHaveBeenCalledTimes(2);
    const body = JSON.parse(res.body);
    expect(body.token).toBe(fakeToken);
  });
  test('error', async () => {
    mockSMResponse.mockRejectedValue(new Error('some error'));
    const res = await handler({ body: '{}' } as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe('InternalServerError');
  });

  test('no body', async () => {
    const res = await handler({} as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe('Bad Payload');
  });
});