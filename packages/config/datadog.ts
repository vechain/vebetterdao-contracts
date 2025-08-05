// config/datadog.ts

/**
 * Retrieves the Datadog application token from environment variables.
 *
 * @returns {string} The Datadog application token or an empty string if not found.
 */
const getEnvDatadogApp = () => {
  const token = process.env.NEXT_PUBLIC_DATADOG_APP_TOKEN

  return token ?? ""
}

/**
 * Retrieves the Datadog client token from environment variables.
 *
 * @returns {string} The Datadog client token or an empty string if not found.
 */
const getEnvDatadogClient = () => {
  const token = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN

  return token ?? ""
}

/**
 * Retrieves the Datadog environment variable from environment variables.
 *
 * @returns {string} The Datadog environment variable or an empty string if not found.
 */
const getEnvDatadogEnv = () => {
  const token = process.env.NEXT_PUBLIC_DATADOG_ENV

  return token ?? ""
}

export { getEnvDatadogApp, getEnvDatadogClient, getEnvDatadogEnv }
