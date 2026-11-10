import { CommitlintConfig } from '@commitlint/types';

const config: CommitlintConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 100],
    'header-max-length': [2, 100],
    'scope-empty': [0, 'never'],
    'scope-case': [2, 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-case': [2, 'sentence-case'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
  },
};

export default config;
