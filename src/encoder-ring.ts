// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import SecretsManager from 'aws-sdk/clients/secretsmanager';
import { JWK, JWS } from 'node-jose';

const sm = new SecretsManager({ region: `${process.env.AWS_REGION}` });

export const signToken = async (tokenPayload: any, keyBuffer: Buffer) => {
  const key = await JWK.asKey(keyBuffer);

  const signOptions = { compact: true, fields: { typ: 'jwt' } };
  const currentTime = Math.floor(Date.now() / 1000);
  const payload = {
    exp: currentTime + 86400, // 1 Day from now
    iat: currentTime,
    sub: tokenPayload.userId,
    ...tokenPayload,
  };
  return (await JWS.createSign(signOptions, key).update(JSON.stringify(payload)).final()).toString();
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: 'Bad Payload',
    };
  }

  try {
    const tokenPayload = JSON.parse(event.body);

    const secret = await sm.getSecretValue({ SecretId: `${process.env.SECRET_ID}` }).promise();
    const jwks = JSON.parse(`${secret.SecretString}`);
    const token = await signToken(tokenPayload, jwks);

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    console.error(error.message);

    return {
      statusCode: 500,
      body: 'InternalServerError',
    };
  }
};