import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'WinterYukky',
  authorAddress: '49480575+WinterYukky@users.noreply.github.com',
  cdkVersion: '2.65.0',
  defaultReleaseBranch: 'main',
  name: 'aws-cdk-database-cluster-endpoint',
  projenrcTs: true,
  repositoryUrl:
    'https://github.com/WinterYukky/aws-cdk-database-cluster-endpoint.git',
  keywords: ['rds', 'aurora', 'custom-endpoint'],
  eslintOptions: {
    dirs: ['src'],
    prettier: true,
  },
  prettier: true,
  prettierOptions: {
    settings: {
      singleQuote: true,
    },
  },
  deps: [] /* Runtime dependencies of this module. */,
  description:
    'Construct library to create custom endpoints for Amazon Aurora with the AWS CDK' /* The description is just a string that helps people understand the purpose of the package. */,
  devDeps: [
    'esbuild',
    '@aws-sdk/client-rds',
    '@types/aws-lambda',
  ] /* Build dependencies for this module. */,
  // packageName: undefined,  /* The "name" in package.json. */
  testdir: 'src/lib',
});
project.synth();
