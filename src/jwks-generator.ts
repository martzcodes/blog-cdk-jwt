import S3 from 'aws-sdk/clients/s3';
import SecretsManager from 'aws-sdk/clients/secretsmanager';
import { JWK } from 'node-jose';

const sm = new SecretsManager({ region: `${process.env.AWS_REGION}` });
const s3 = new S3();

export const handler = async (): Promise<void> => {
  // when invoked this regenerates the jwks and stores the secret in secrets manager and public in s3
  try {
    const keyStore = JWK.createKeyStore();
    const key = await keyStore.generate('RSA', 2048, {
      alg: 'RS256',
      use: 'sig',
    });

    const secret = key.toJSON(true);
    await sm
      .putSecretValue({
        SecretId: `${process.env.SECRET_ID}`,
        SecretString: JSON.stringify(secret),
      })
      .promise();

    const publicKey = key.toJSON();
    await s3
      .putObject({
        Bucket: `${process.env.BUCKET_ID}`,
        Key: 'jwks.json',
        Body: JSON.stringify(publicKey),
        ACL: 'bucket-owner-full-control',
      })
      .promise();
  } catch (e) {
    console.error(e);
    throw e;
  }
};