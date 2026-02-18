import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'WinterYukky',
  authorAddress: '49480575+WinterYukky@users.noreply.github.com',
  cdkVersion: '2.183.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.9.0',
  name: 'aws-cdk-database-cluster-endpoint',
  projenrcTs: true,
  repositoryUrl:
    'https://github.com/WinterYukky/aws-cdk-database-cluster-endpoint.git',
  keywords: ['rds', 'aurora', 'custom-endpoint'],

  // Multi-language publishing configuration
  publishToNuget: {
    dotNetNamespace: 'WinterYukky.AwsCdk.DatabaseClusterEndpoint',
    packageId: 'WinterYukky.AwsCdk.DatabaseClusterEndpoint',
  },
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
  gitignore: ['src/lib/**/*.js'],
  githubOptions: {
    pullRequestLintOptions: {
      semanticTitleOptions: {
        types: [
          'feat',
          'fix',
          'chore',
          'ci',
          'docs',
          'style',
          'refactor',
          'test',
          'revert',
          'Revert',
        ],
      },
      contributorStatement:
        '_By submitting this pull request, I confirm that my contribution is made under the terms of the Apache-2.0 license_',
      contributorStatementOptions: {
        exemptLabels: ['auto-upgrade'],
      },
    },
  },
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-upgrade'],
    },
  },
  experimentalIntegRunner: true,
  integrationTestAutoDiscover: false,
  // packageName: undefined,  /* The "name" in package.json. */
});

// complie the custom resource Lambda functions
const complieCustomResourceCommand =
  'yarn esbuild src/lib/wait-for-action-finish/index.ts --bundle --outdir=src/lib/wait-for-action-finish/ --platform=node --external:@aws-sdk/client-rds';
project.preCompileTask.exec(complieCustomResourceCommand);
project.testTask.prependExec(complieCustomResourceCommand);
project.tasks.all
  .filter((task) => task.name.startsWith('integ'))
  .forEach((task) => task.prependExec(complieCustomResourceCommand));
project.synth();
