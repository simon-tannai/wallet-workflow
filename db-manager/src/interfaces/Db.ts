export default interface Db {
  database: any;
  connect(): void;
  disconnect(): void;
}
