/**
 * smtp-checker — программный интерфейс. / Programmatic API.
 *
 * import { checkSmtp } from 'smtp-checker'; // или const { checkSmtp } = require('smtp-checker')
 */

export type Language = 'ru' | 'en';

export type AuthMechanism = 'PLAIN' | 'LOGIN' | 'CRAM-MD5' | 'XOAUTH2';

/** implicit — TLS с первого байта (465), starttls — апгрейд по STARTTLS, plain — без шифрования. */
export type ConnectionMode = 'implicit' | 'starttls' | 'plain';

export type StepId = 'connect' | 'tls' | 'greeting' | 'ehlo' | 'starttls' | 'auth' | 'send';

export type StepStatus = 'running' | 'ok' | 'skip' | 'fail';

export interface LocalizedText {
  ru: string;
  en: string;
}

export interface Provider {
  id?: string;
  title: LocalizedText;
  host: string;
  port: number;
  secure: boolean;
  altPorts?: number[];
  domains?: string[];
  defaultUser?: string;
  credentialsUrl?: string;
  docsUrl?: string;
  notes?: LocalizedText;
  /** Домен, по которому провайдер был определён автоматически. */
  detectedFrom?: string;
}

export interface TlsInfo {
  protocol: string | null;
  cipher: string | null;
  authorized: boolean;
  authorizationError: string | null;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  altNames: string | null;
}

export interface Capabilities {
  raw: string[];
  auth: string[];
  size: number | null;
  starttls: boolean;
  pipelining: boolean;
  eightBitMime: boolean;
  enhancedStatusCodes: boolean;
  smtputf8: boolean;
}

export interface SmtpReply {
  code: number;
  lines: string[];
  text: string;
}

export interface CheckStep {
  id: StepId;
  label: string;
  status: StepStatus;
  ms: number;
  detail: string | null;
  tls?: TlsInfo;
  capabilities?: Capabilities;
  mechanism?: string;
}

export interface CheckErrorInfo {
  message: string;
  smtpCode: number | null;
  smtpText: string | null;
  networkCode: string | null;
  hints: string[];
}

export interface CheckResult {
  ok: boolean;
  host: string;
  port: number;
  mode: ConnectionMode;
  user: string | null;
  provider: string | null;
  greeting?: string;
  steps: CheckStep[];
  tls: TlsInfo | null;
  capabilities: Capabilities | null;
  auth: { mechanism: string; advertised: boolean; ok: boolean } | null;
  message: {
    to: string;
    from: string;
    subject: string;
    messageId: string;
    size: number;
    response: string;
  } | null;
  error: CheckErrorInfo | null;
  elapsedMs: number;
}

export type CheckEvent =
  | { type: 'step:start' | 'step:done' | 'step:skip' | 'step:fail'; step: CheckStep }
  | { type: 'wire'; direction: 'in' | 'out'; line: string };

export interface CheckOptions {
  /** Ключ пресета из PROVIDERS, например 'gmail'. */
  provider?: string;
  host?: string;
  port?: number | string;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
  /** Отправить тестовое письмо, а не только войти. */
  send?: boolean;
  /** Принудительно implicit TLS. */
  secure?: boolean;
  /** Принудительно STARTTLS. */
  starttls?: boolean;
  /** Без шифрования — только для локальных серверов. */
  plain?: boolean;
  /** Не проверять сертификат. */
  insecure?: boolean;
  /** Не аутентифицироваться. */
  'no-auth'?: boolean;
  auth?: AuthMechanism | string;
  /** Access token для XOAUTH2. */
  oauth?: string;
  subject?: string;
  text?: string;
  helo?: string;
  /** Таймаут в миллисекундах, 100…600000. По умолчанию 20000. */
  timeout?: number | string;
  lang?: Language;
  /** Переменные окружения для разбора вместо process.env. По умолчанию — пустой объект. */
  env?: Record<string, string | undefined>;
  onEvent?: (event: CheckEvent) => void;
}

export interface ResolvedConfig {
  provider: Provider | null;
  host: string;
  port: number;
  secure: boolean;
  useStarttls: boolean;
  allowPlain: boolean;
  rejectUnauthorized: boolean;
  user: string | null;
  pass?: string | null;
  from: string | null;
  to: string | null;
  auth: boolean;
  mechanism: string | null;
  accessToken: string | null;
  send: boolean;
  subject: string | null;
  text: string | null;
  helo: string | null;
  timeout: number;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: boolean;
  dryRun: boolean;
  probe: boolean;
  ports: number[] | null;
}

export interface ProbeResult {
  port: number;
  open: boolean;
  tls: boolean;
  banner: string | null;
  error: string | null;
  ms: number;
}

export interface TestMessage {
  raw: string;
  subject: string;
  messageId: string;
  size: number;
}

/** Ошибка конфигурации: .i18nKey — ключ строки из словаря, .params — подстановки. */
export declare class ConfigError extends Error {
  i18nKey: string;
  params: Record<string, unknown>;
}

export declare class SmtpClient {
  constructor(options: {
    host: string;
    port: number;
    secure?: boolean;
    timeout?: number;
    rejectUnauthorized?: boolean;
    servername?: string;
  });
  readonly tlsInfo: TlsInfo | null;
  /** @returns время подключения в миллисекундах */
  connect(): Promise<number>;
  upgradeToTls(): Promise<number>;
  read(): Promise<SmtpReply>;
  write(line: string, options?: { redact?: boolean }): void;
  writeRaw(data: string): void;
  command(line: string, options?: { expect?: number | number[]; redact?: boolean }): Promise<SmtpReply>;
  close(): Promise<void>;
  destroy(): void;
  on(event: 'command' | 'reply', listener: (payload: never) => void): this;
}

/** Полная проверка одним вызовом. Никогда не бросает — ошибка попадает в result.error. */
export declare function checkSmtp(options?: CheckOptions): Promise<CheckResult>;

export declare function runCheck(
  config: ResolvedConfig,
  context?: { t?: (key: string, params?: Record<string, unknown>) => string; lang?: Language; onEvent?: (event: CheckEvent) => void }
): Promise<CheckResult>;

export declare function probePorts(
  host: string,
  ports: number[],
  timeout?: number,
  implicitTlsPorts?: number[]
): Promise<ProbeResult[]>;

export declare function resolveConfig(args: Record<string, unknown>, env?: Record<string, string | undefined>): ResolvedConfig;

export declare function connectionMode(config: Pick<ResolvedConfig, 'secure' | 'useStarttls'>): ConnectionMode;

export declare const PROVIDERS: Record<string, Provider>;

export declare function listProviders(): string[];

export declare function getProvider(key: string): Provider | null;

export declare function detectProvider(address: string | null | undefined): Provider | null;

export declare function parseCapabilities(replyLines: string[]): Capabilities;

export declare function parseReply(buffer: string): { reply: SmtpReply; rest: string } | null;

export declare function buildTestMessage(options: {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  context: {
    t: (key: string, params?: Record<string, unknown>) => string;
    host: string;
    port: number;
    mode: string;
    user: string | null;
    date?: Date;
  };
}): TestMessage;

export declare function createTranslator(lang: Language): (key: string, params?: Record<string, unknown>) => string;

export declare function detectLanguage(env?: Record<string, string | undefined>): Language;
