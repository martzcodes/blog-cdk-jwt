import { join } from 'path';
import { AwsIntegration, IntegrationResponse, LambdaIntegration, RestApi } from '@aws-cdk/aws-apigateway';
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Runtime } from '@aws-cdk/aws-lambda';
import { LogLevel, NodejsFunction, NodejsFunctionProps } from '@aws-cdk/aws-lambda-nodejs';
import { BlockPublicAccess, Bucket, BucketAccessControl } from '@aws-cdk/aws-s3';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { App, Construct, CustomResource, Duration, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';
import { Provider } from '@aws-cdk/custom-resources';

export class BlogCdkJwksStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const SECRET_ID = 'BlogCdkSecret';
    const secret = new Secret(this, SECRET_ID);

    const BUCKET_ID = 'BlogCdkJwksBucket';
    const jwksBucket = new Bucket(this, BUCKET_ID, {
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      bucketName: `blog-cdk-jwks-bucket-${this.account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const bucketRole = new Role(this, 'BlogCdkJwksBucketRole', {
      roleName: 'BlogCdkJwksBucketRole',
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    jwksBucket.grantRead(bucketRole);

    const lambdaProps: Partial<NodejsFunctionProps> = {
      bundling: {
        target: 'es2020',
        logLevel: LogLevel.ERROR,
      },
      runtime: Runtime.NODEJS_14_X,
      environment: {
        NODE_ENV: process.env.NODE_ENV as string,
        SECRET_ID: secret.secretArn,
        BUCKET_ID: jwksBucket.bucketName,
      },
    };

    const jwksGenerator = new NodejsFunction(this, 'BlogCdkJwksGenerator', {
      ...lambdaProps,
      timeout: Duration.seconds(30),
      entry: join(__dirname, './jwks-generator.ts'),
    });
    secret.grantWrite(jwksGenerator);
    jwksBucket.grantWrite(jwksGenerator);

    const jwksGeneratorProvider = new Provider(this, 'BlogCdkJwksGenerateProvider', {
      onEventHandler: jwksGenerator,
    });

    new CustomResource(this, 'BlogCdkJwksGenerateResource', {
      serviceToken: jwksGeneratorProvider.serviceToken,
      properties: {
        // Bump to force an update
        Version: '2',
      },
    });

    const restApi = new RestApi(this, 'BlogCdkJwksApi');

    const jwksIntegration = new AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'GET',
      path: `${jwksBucket.bucketName}/jwks.json`,
      options: {
        credentialsRole: bucketRole,
        // integration responses are required!
        integrationResponses: [
          {
            'statusCode': '200',
            'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            'method.response.header.Content-Disposition': 'integration.response.header.Content-Disposition',
          } as IntegrationResponse,
          { statusCode: '400' },
        ],
      },
    });

    restApi.root
      .addResource('.well-known')
      .addResource('jwks.json')
      .addMethod('GET', jwksIntegration, {
        methodResponses: [{ statusCode: '200' }],
      });

    const encoderFunction = new NodejsFunction(this, 'BlogCdkJwtEncoderFn', {
      ...lambdaProps,
      entry: join(__dirname, './encoder-ring.ts'),
    });
    secret.grantRead(encoderFunction);

    restApi.root.addResource('encode').addMethod('POST', new LambdaIntegration(encoderFunction));

    const decoderFunction = new NodejsFunction(this, 'BlogCdkJwtDecoderFn', {
      ...lambdaProps,
      entry: join(__dirname, './decoder-ring.ts'),
    });

    restApi.root.addResource('decode').addMethod('POST', new LambdaIntegration(decoderFunction));
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new BlogCdkJwksStack(app, 'blog-cdk-jwks-dev', { env: devEnv });

app.synth();