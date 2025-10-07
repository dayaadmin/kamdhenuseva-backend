/**
 * Checks if an OTP resend is allowed for the given expiration timestamp.
 *
 * @param {Date | number | undefined} otpExpiresAt - The stored expiration timestamp.
 * @param {number} currentTimeMs - The current timestamp in ms (defaults to Date.now()).
 * @returns {{ allowed: boolean, secondsLeft?: number }}
 */
export function isOTPResendAllowed(otpExpiresAt, currentTimeMs = Date.now()) {
  if (!otpExpiresAt || new Date(otpExpiresAt).getTime() <= currentTimeMs) {
    return { allowed: true };
  }

  const secondsLeft = Math.ceil(
    (new Date(otpExpiresAt).getTime() - currentTimeMs) / 1000,
  );
  return {
    allowed: false,
    secondsLeft,
  };
}
