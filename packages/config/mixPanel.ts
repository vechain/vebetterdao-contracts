// config/mixPanel.ts

/**
 * Retrieves the MixPanel environment variable from environment variables.
 *
 * @returns {string} The MixPanel environment variable or an empty string if not found.
 */
const getEnvMixPanel = () => {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN
  return token ?? ""
}

export { getEnvMixPanel }
