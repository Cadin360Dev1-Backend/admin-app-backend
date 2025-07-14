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
    
    const response = await axios.get(apiUrl);
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
    console.error(`Error fetching geolocation for IP ${ip}:`, error.message);
    return null; // Return null on error
  }
};