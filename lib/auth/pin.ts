import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Genera hash bcrypt di un PIN numerico
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

/**
 * Verifica un PIN contro il suo hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}
