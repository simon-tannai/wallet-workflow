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

## Postman Collection
[Wallet Manager API](postman_collection.json)

_Note: collection v2.1_

## Main Node.js dependencies
- TypeScript: v3.8
- Express: v4
- Mongoose: v5

### My development environment
- macOS Catalina: v10.15.
- Visual Studio Code: v1.43

VS Code settings:
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
