export interface WeatherData {
  time: string;
  weathercode: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
}

// Convert Open-Meteo WMO weather code to Lucide Icon string
export function getWeatherIconName(code: number): string {
  // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
  if (code === 0) return 'Sun'; // Clear sky
  if (code === 1 || code === 2 || code === 3) return 'CloudSun'; // Mainly clear, partly cloudy, and overcast
  if (code === 45 || code === 48) return 'CloudFog'; // Fog
  if (code >= 51 && code <= 67) return 'CloudRain'; // Drizzle / Rain
  if (code >= 71 && code <= 77) return 'Snowflake'; // Snow
  if (code >= 80 && code <= 82) return 'CloudRain'; // Rain showers
  if (code >= 85 && code <= 86) return 'Snowflake'; // Snow showers
  if (code >= 95) return 'CloudLightning'; // Thunderstorm
  return 'Cloud';
}

export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Cerah';
  if (code === 1 || code === 2 || code === 3) return 'Berawan';
  if (code === 45 || code === 48) return 'Berkabut';
  if (code >= 51 && code <= 67) return 'Hujan';
  if (code >= 71 && code <= 77) return 'Salju';
  if (code >= 80 && code <= 82) return 'Hujan Deras';
  if (code >= 85 && code <= 86) return 'Badai Salju';
  if (code >= 95) return 'Badai Petir';
  return 'Tidak Diketahui';
}

export async function geocodeCity(city: string): Promise<GeocodingResult | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return {
        latitude: data.results[0].latitude,
        longitude: data.results[0].longitude,
        name: data.results[0].name,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to geocode city:", error);
    return null;
  }
}

export async function getWeatherForecast(lat: number, lng: number): Promise<WeatherData[]> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`);
    const data = await res.json();
    
    if (data.daily) {
      const forecast: WeatherData[] = [];
      for (let i = 0; i < data.daily.time.length; i++) {
        forecast.push({
          time: data.daily.time[i],
          weathercode: data.daily.weathercode[i],
          temperature_2m_max: data.daily.temperature_2m_max[i],
          temperature_2m_min: data.daily.temperature_2m_min[i],
        });
      }
      return forecast;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch weather forecast:", error);
    return [];
  }
}
