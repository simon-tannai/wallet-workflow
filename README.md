# Wallet Manager
Node.js & TypeScript projet aims to manage wallet transfer workflow.

## Prerequis
- Docker: v19
- Docker-compose: v1.25

## Run
```shell
docker-compose up -d
```

Database well be populated at the first run.

## How to use
See [Wallet Manager API](postman_collection.json) to play with API's endpoints.

_Note: collection v2.1_

## Main Node.js dependencies
- TypeScript: v3.8
- Express: v4
- Mongoose: v5

### Improvements idea
- [ ] Use [Axios Retry](https://github.com/softonic/axios-retry) to implement retry pattern on API requests.
- [ ] Use [IO-TS](https://github.com/gcanti/io-ts) or [Joi](https://hapi.dev/module/joi/) to catch in better way API's parameters values.
- [ ] [Mock APIs](https://jestjs.io/docs/en/tutorial-async) to improve tests.
- [ ] Migrate to [Koa](https://koajs.com/) to implement [HTT2 native module](https://nodejs.org/api/http2.html).

### My development environment
- macOS Catalina: v10.15.
- Visual Studio Code: v1.43

_VS Code settings:_
```json
{
  "editor.fontSize": 14,
  "files.associations": {
    "*.ts": "typescript"
  },
  "editor.tabSize": 2,
  "editor.detectIndentation": false,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.formatOnSave": true,
  "eslint.alwaysShowStatus": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [
    {
      "mode": "auto"
    }
  ]
}
```
