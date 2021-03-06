import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
// eslint-disable-next-line import/no-unresolved
} from 'aws-lambda';
import { decode, verify } from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';


interface Body {
  jwksUri: string;
  token: string;
}

export const getSigningKey = async (client: JwksClient, kid: string): Promise<jwksClient.SigningKey> => {
  return new Promise<jwksClient.SigningKey>((res, rej) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        rej(err);
      } else {
        res(key);
      }
    });
  });
};

export const verifyToken = async (client: JwksClient, token: string) => {
  const decoded = decode(token, { complete: true, json: true });
  if (!decoded || !decoded.header.kid) {
    console.error('No Key ID');
    throw new Error('Token has no Key ID');
  }

  const key = await getSigningKey(client, decoded.header.kid);
  const signingKey = key.getPublicKey();

  if (!signingKey) {
    console.error('No public or rsa key');
    throw new Error('Unauthorized');
  }

  return verify(token, signingKey);
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: 'Bad Payload',
    };
  }

  const body: Body = JSON.parse(event.body) as Body;

  const client = jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: body.jwksUri,
  });

  try {
    const verified = await verifyToken(client, body.token);


    return {
      statusCode: 200,
      body: JSON.stringify(verified),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: e.message,
    };
  }
};