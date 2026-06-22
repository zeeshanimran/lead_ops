import { ConfigService } from '@nestjs/config';

export function requireConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function requireConfigNumber(config: ConfigService, key: string): number {
  const raw = requireConfig(config, key);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}
