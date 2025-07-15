// src/utils/geolocation.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const IPINFO_API_TOKEN = process.env.IPINFO_API_TOKEN;

/**
 * Fetches comprehensive geolocation details for a given IP address using ipinfo.io.
 * @param {string} ip - The IP address to geolocate.
 * @returns {Promise<object|null>} An object containing full geo details or null if an error occurs.
 */
export const getGeolocation = async (ip) => {
  if (!IPINFO_API_TOKEN) {
    console.error("IPINFO_API_TOKEN is not set in environment variables.");
    return null;
  }

  try {
    const apiUrl = `https://ipinfo.io/${ip}/json?token=${IPINFO_API_TOKEN}`;

    // Add a timeout to the axios request (e.g., 5 seconds)
    const response = await axios.get(apiUrl, { timeout: 5000 }); // 5 seconds timeout
    const data = response.data;

    return {
      geo_ip: data.ip || null, // Explicitly include IP in the returned object
      geo_hostname: data.hostname || null,
      geo_city: data.city || null,
      geo_region: data.region || null,
      geo_country: data.country || null, // ISO 3166-1 alpha-2 country code
      geo_loc: data.loc || null, // Latitude,Longitude (e.g., "28.4089,77.3178")
      geo_org: data.org || null, // Organization (ISP)
      geo_postal: data.postal || null, // Postal code
      geo_timezone: data.timezone || null, // Timezone (e.g., "Asia/Kolkata")
    };
  } catch (error) {
    // Log the actual error type and message for better debugging
    console.error(`Error fetching geolocation for IP ${ip}:`, error.message);
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.error('IPInfo API Response Error Data:', error.response.data);
        console.error('IPInfo API Response Status:', error.response.status);
        console.error('IPInfo API Response Headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received (e.g., network error or timeout)
        console.error('IPInfo API No Response:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('IPInfo API Request Setup Error:', error.message);
      }
    }
    return null; // Return null on error so the main function can proceed
  }
};