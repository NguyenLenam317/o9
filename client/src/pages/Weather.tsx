import React, { ReactElement, useEffect } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import CurrentWeather from '@/components/dashboard/CurrentWeather';
import AirQuality from '@/components/dashboard/AirQuality';
import { useUser } from '@/hooks/useUser';
import { WeatherData, AirQualityData } from '@/types/index';

const Weather = (): ReactElement => {
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'historical'>('current');
  const { user } = useUser();
  
  // Utility function to safely handle potentially undefined data
  const safelyAccessData = <T,>(data: T | undefined, path: string, defaultValue: any = null) => {
    try {
      return path.split('.').reduce((obj, key) => obj?.[key], data) || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // Fetch current weather data
  const { 
    data: currentData, 
    isLoading: currentLoading 
  } = useQuery<WeatherData>({
    queryKey: ['/api/weather/current'],
    enabled: true,
  });

  // Fetch forecast data with explicit error handling
  const { 
    data: forecastData, 
    isLoading: forecastLoading, 
    error: forecastError 
  } = useQuery<WeatherData, Error>({
    queryKey: ['/api/weather/forecast'],
    enabled: activeTab === 'forecast',
    onError: (error: Error) => {
      console.error('Forecast data fetch error:', error.message);
    }
  });

  // Fetch historical data
  const { 
    data: historicalData, 
    isLoading: historicalLoading 
  } = useQuery<WeatherData>({
    queryKey: ['/api/weather/historical'],
    enabled: activeTab === 'historical',
  });

  // Fetch air quality data
  const { 
    data: airQualityData, 
    isLoading: airQualityLoading 
  } = useQuery<AirQualityData>({
    queryKey: ['/api/weather/air-quality'],
    enabled: true,
  });

  // Debug logging for forecast data
  useEffect(() => {
    if (forecastData) {
      console.log('Full forecast data:', JSON.stringify(forecastData, null, 2));
      console.log('Forecast daily data:', forecastData.daily);
    }
    if (forecastError) {
      console.error('Forecast data error:', forecastError);
    }
  }, [forecastData, forecastError]);

  // Helper function to format historical chart data
  const formatHistoricalChartData = (data: WeatherData): { name: string; temperature: number; precipitation: number }[] => {
    console.log('Historical data received:', data);
    
    if (!data || !data.daily) {
      return [];
    }

    return (data.daily.time || []).map((date: string, index: number) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      temperature: 
        data.daily?.temperature_2m_min?.[index] || 
        data.daily?.temperature_2m_mean?.[index] || 
        data.daily?.temperature_2m_max?.[index] || 
        0,
      precipitation: data.daily?.precipitation_sum?.[index] || 0
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h2 className="text-2xl font-heading font-semibold mb-6">Weather in Hanoi</h2>
        
        <Tabs defaultValue="current" value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="current">Current Weather</TabsTrigger>
            <TabsTrigger value="forecast">7-Day Forecast</TabsTrigger>
            <TabsTrigger value="historical">Historical Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="current" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {!currentLoading && currentData ? (
                <CurrentWeather 
                  data={currentData}
                  isLoading={false}
                  className="col-span-2"
                />
              ) : (
                <CurrentWeather 
                  data={{} as WeatherData}
                  isLoading={true}
                  className="col-span-2"
                />
              )}
              {!airQualityLoading && airQualityData ? (
                <AirQuality 
                  data={airQualityData}
                  isLoading={false}
                  userProfile={user?.userProfile}
                />
              ) : (
                <AirQuality 
                  data={{} as AirQualityData}
                  isLoading={true}
                  userProfile={user?.userProfile}
                />
              )}
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Today's Hourly Forecast</CardTitle>
                <CardDescription>Detailed hourly forecast starting from the next hour</CardDescription>
              </CardHeader>
              <CardContent>
                {currentLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <>
                    {/* Temperature and Feels Like Chart */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium mb-3">Temperature and Feels Like</h4>
                      <ResponsiveLineChart
                        data={(() => {
                          // Get current hour to start from next hour
                          const currentHour = new Date().getHours();
                          const hourlyData = [];
                          
                          // Map hourly data starting from current hour
                          if (currentData?.hourly?.time) {
                            for (let i = 0; i < currentData.hourly.time.length; i++) {
                              const timeStr = currentData.hourly.time[i];
                              const time = new Date(timeStr);
                              // Only include future hours (from next hour onwards)
                              if (time.getHours() > currentHour || time.getDate() > new Date().getDate()) {
                                hourlyData.push({
                                  name: time.getHours() + 'h',
                                  hour: time.getHours(),
                                  temperature: currentData.hourly.temperature_2m?.[i] || 
                                               currentData.hourly.temperature?.[i] || 0,
                                  feels_like: currentData.hourly.apparent_temperature?.[i] || 
                                              currentData.hourly.apparentTemperature?.[i] || null,
                                });
                                
                                // Break once we have 24 hours of forecast
                                if (hourlyData.length >= 24) break;
                              }
                            }
                          }
                          
                          return hourlyData;
                        })()}
                        lines={[
                          { key: 'temperature', color: '#1976d2', name: 'Temperature (°C)' },
                          { key: 'feels_like', color: '#f57c00', name: 'Feels Like (°C)' },
                        ]}
                        height={200}
                        xAxisLabel="Hour"
                        yAxisLabel="Temperature (°C)"
                      />
                    </div>
                    
                    {/* Precipitation Chart */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium mb-3">Precipitation Forecast</h4>
                      <ResponsiveBarChart
                        data={(() => {
                          // Get current hour to start from next hour
                          const currentHour = new Date().getHours();
                          const hourlyData = [];
                          
                          // Map hourly data starting from current hour
                          if (currentData?.hourly?.time) {
                            for (let i = 0; i < currentData.hourly.time.length; i++) {
                              const timeStr = currentData.hourly.time[i];
                              const time = new Date(timeStr);
                              // Only include future hours (from next hour onwards)
                              if (time.getHours() > currentHour || time.getDate() > new Date().getDate()) {
                                hourlyData.push({
                                  name: time.getHours() + 'h',
                                  probability: currentData.hourly.precipitation_probability?.[i] || 0,
                                  amount: currentData.hourly.precipitation?.[i] || 
                                          currentData.hourly.precipitation_sum?.[i] || 0,
                                });
                                
                                // Break once we have 24 hours of forecast
                                if (hourlyData.length >= 24) break;
                              }
                            }
                          }
                          
                          return hourlyData;
                        })()}
                        bars={[
                          { key: 'probability', color: '#2196f3', name: 'Probability (%)' },
                          { key: 'amount', color: '#4fc3f7', name: 'Amount (mm)' }
                        ]}
                        height={180}
                      />
                    </div>
                    
                    {/* Additional Weather Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-3">Humidity and Wind</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                          {(() => {
                            // Get current hour to start from next hour
                            const currentHour = new Date().getHours();
                            const hourlyDetails = [];
                            
                            // Map hourly data starting from current hour
                            if (currentData?.hourly?.time) {
                              for (let i = 0; i < currentData.hourly.time.length; i++) {
                                const timeStr = currentData.hourly.time[i];
                                const time = new Date(timeStr);
                                // Only include future hours (from next hour onwards)
                                if (time.getHours() > currentHour || time.getDate() > new Date().getDate()) {
                                  const humidity = currentData.hourly.relative_humidity_2m?.[i] || 
                                                  currentData.hourly.humidity?.[i] || 0;
                                  const windSpeed = currentData.hourly.wind_speed_10m?.[i] || 
                                                   currentData.hourly.wind_speed?.[i] || 0;
                                  
                                  hourlyDetails.push(
                                    <div key={i} className="bg-gray-50 p-2 rounded-lg flex flex-col items-center">
                                      <span className="font-medium">{time.getHours()}:00</span>
                                      <div className="flex items-center mt-1">
                                        <span className="material-icons text-xs mr-1">water_drop</span>
                                        <span>{humidity}%</span>
                                      </div>
                                      <div className="flex items-center mt-1">
                                        <span className="material-icons text-xs mr-1">air</span>
                                        <span>{windSpeed} km/h</span>
                                      </div>
                                    </div>
                                  );
                                  
                                  // Break once we have enough detail boxes
                                  if (hourlyDetails.length >= 9) break;
                                }
                              }
                            }
                            
                            return hourlyDetails;
                          })()}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-3">Weather Conditions</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                          {(() => {
                            // Get current hour to start from next hour
                            const currentHour = new Date().getHours();
                            const hourlyConditions = [];
                            
                            // Map hourly data starting from current hour
                            if (currentData?.hourly?.time) {
                              for (let i = 0; i < currentData.hourly.time.length; i++) {
                                const timeStr = currentData.hourly.time[i];
                                const time = new Date(timeStr);
                                // Only include future hours (from next hour onwards)
                                if (time.getHours() > currentHour || time.getDate() > new Date().getDate()) {
                                  const weatherCode = currentData.hourly.weather_code?.[i] || 0;
                                  
                                  // Map weather code to icon
                                  let weatherIcon = 'help_outline'; // default
                                  if (weatherCode <= 3) weatherIcon = 'wb_sunny';
                                  else if (weatherCode <= 49) weatherIcon = 'cloud';
                                  else if (weatherCode <= 59) weatherIcon = 'grain';
                                  else if (weatherCode <= 69) weatherIcon = 'ac_unit';
                                  else if (weatherCode <= 79) weatherIcon = 'ac_unit';
                                  else if (weatherCode <= 82) weatherIcon = 'rainy';
                                  else if (weatherCode <= 86) weatherIcon = 'ac_unit';
                                  else weatherIcon = 'thunderstorm';
                                  
                                  // Get weather description based on code
                                  let description = 'Unknown';
                                  if (weatherCode <= 3) description = 'Clear';
                                  else if (weatherCode <= 49) description = 'Cloudy';
                                  else if (weatherCode <= 59) description = 'Drizzle';
                                  else if (weatherCode <= 69) description = 'Rain';
                                  else if (weatherCode <= 79) description = 'Snow';
                                  else if (weatherCode <= 82) description = 'Showers';
                                  else if (weatherCode <= 86) description = 'Snow';
                                  else description = 'Thunder';
                                  
                                  hourlyConditions.push(
                                    <div key={i} className="bg-gray-50 p-2 rounded-lg flex flex-col items-center">
                                      <span className="font-medium">{time.getHours()}:00</span>
                                      <span className="material-icons text-lg my-1">{weatherIcon}</span>
                                      <span className="text-[10px]">{description}</span>
                                    </div>
                                  );
                                  
                                  // Break once we have enough detail boxes
                                  if (hourlyConditions.length >= 9) break;
                                }
                              }
                            }
                            
                            return hourlyConditions;
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="forecast" className="space-y-6">
            {forecastLoading ? (
              <>
                <Skeleton className="h-[200px] w-full rounded-lg mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                  <Skeleton className="h-[300px] w-full rounded-lg" />
                </div>
              </>
            ) : forecastData ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="overflow-hidden text-ellipsis whitespace-nowrap max-w-full truncate">7-Day Temperature Forecast</CardTitle>
                    <CardDescription>Min, max and average temperatures for the next week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveLineChart
                      data={(forecastData.daily?.time || []).map((date: string, i: number) => {
                        // Make sure the temperature arrays exist and have data at this index
                        const min = forecastData.daily?.temperature_2m_min?.[i] || 0;
                        const max = forecastData.daily?.temperature_2m_max?.[i] || 0;
                        
                        return {
                          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                          min: min,
                          max: max,
                          avg: (min + max) / 2,
                        };
                      })}
                      lines={[
                        { key: 'min', color: '#0288d1', name: 'Min Temp (°C)' },
                        { key: 'avg', color: '#f57c00', name: 'Avg Temp (°C)' },
                        { key: 'max', color: '#d32f2f', name: 'Max Temp (°C)' },
                      ]}
                      height={250}
                    />
                    
                    <h4 className="text-sm font-medium mt-6 mb-3">Daily Weather Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                      {(forecastData.daily?.time || []).map((date: string, i: number) => {
                        const weatherCode = forecastData.daily?.weather_code?.[i] || 0;
                        const windSpeed = forecastData.daily?.wind_speed_10m?.[i] || 
                                         forecastData.daily?.wind_speed?.[i] || 0;
                        const humidity = forecastData.daily?.relative_humidity_2m?.[i] || 
                                        forecastData.daily?.humidity?.[i] || 0;
                        const precipProb = forecastData.daily?.precipitation_probability_max?.[i] || 0;
                        const precipSum = forecastData.daily?.precipitation_sum?.[i] || 0;
                        const sunrise = forecastData.daily?.sunrise?.[i] ? 
                          new Date(forecastData.daily.sunrise[i]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '–';
                        const sunset = forecastData.daily?.sunset?.[i] ? 
                          new Date(forecastData.daily.sunset[i]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '–';
                        
                        // Map weather code to icon and description
                        let weatherIcon = 'help_outline'; // default
                        let description = 'Unknown';
                        if (weatherCode <= 3) { 
                          weatherIcon = 'wb_sunny'; 
                          description = 'Clear';
                        } else if (weatherCode <= 49) { 
                          weatherIcon = 'cloud'; 
                          description = 'Cloudy';
                        } else if (weatherCode <= 59) { 
                          weatherIcon = 'grain'; 
                          description = 'Drizzle';
                        } else if (weatherCode <= 69) { 
                          weatherIcon = 'rainy'; 
                          description = 'Rain';
                        } else if (weatherCode <= 79) { 
                          weatherIcon = 'ac_unit'; 
                          description = 'Snow';
                        } else if (weatherCode <= 82) { 
                          weatherIcon = 'rainy'; 
                          description = 'Showers';
                        } else if (weatherCode <= 86) { 
                          weatherIcon = 'ac_unit'; 
                          description = 'Snow';
                        } else { 
                          weatherIcon = 'thunderstorm'; 
                          description = 'Thunder';
                        }
                        
                        // Format date display
                        const dayDate = new Date(date);
                        const day = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                        const dateFormatted = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        
                        return (
                          <div key={date} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{day}</span>
                              <span className="text-xs">{dateFormatted}</span>
                            </div>
                            
                            <div className="flex items-center justify-center mb-2">
                              <span className="material-icons text-3xl">{weatherIcon}</span>
                            </div>
                            
                            <div className="text-xs text-center mb-2">{description}</div>
                            
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium">Min/Max</span>
                              <span className="text-xs">
                                {forecastData.daily?.temperature_2m_min?.[i] || 0}° / {forecastData.daily?.temperature_2m_max?.[i] || 0}°
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center">
                                <span className="material-icons text-xs mr-1">water_drop</span>
                                <span className="text-xs">Precip.</span>
                              </div>
                              <span className="text-xs">{precipProb}% | {precipSum}mm</span>
                            </div>
                            
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center">
                                <span className="material-icons text-xs mr-1">air</span>
                                <span className="text-xs">Wind</span>
                              </div>
                              <span className="text-xs">{windSpeed} km/h</span>
                            </div>
                            
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center">
                                <span className="material-icons text-xs mr-1">humidity_percentage</span>
                                <span className="text-xs">Humidity</span>
                              </div>
                              <span className="text-xs">{humidity}%</span>
                            </div>
                            
                            <div className="text-xs text-center mt-1 border-t pt-1">
                              <div className="flex justify-between">
                                <div className="flex items-center">
                                  <span className="material-icons text-xs mr-1">wb_twilight</span>
                                  <span>{sunrise}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="material-icons text-xs mr-1">wb_twilight</span>
                                  <span>{sunset}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="overflow-hidden text-ellipsis whitespace-nowrap max-w-full truncate">Precipitation Forecast</CardTitle>
                      <CardDescription className="overflow-hidden overflow-wrap-break-word text-ellipsis max-w-full line-clamp-2">Expected precipitation in mm</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveBarChart
                        data={(forecastData.daily?.time || []).map((date: string, i: number) => {
                          // Safely access data with fallbacks
                          return {
                            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                            amount: forecastData.daily?.precipitation_sum?.[i] || 0,
                            probability: forecastData.daily?.precipitation_probability_max?.[i] || 0,
                          };
                        })}
                        bars={[
                          { key: 'amount', color: '#0288d1', name: 'Amount (mm)' },
                          { key: 'probability', color: '#4fc3f7', name: 'Probability (%)' }
                        ]}
                        height={250}
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="overflow-hidden text-ellipsis whitespace-nowrap max-w-full truncate">Weather Conditions</CardTitle>
                      <CardDescription className="overflow-hidden overflow-wrap-break-word text-ellipsis max-w-full line-clamp-2">Daily weather conditions and wind speed</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {forecastLoading ? (
                          Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="animate-pulse bg-gray-200 rounded-lg h-24 w-full"></div>
                          ))
                        ) : forecastData?.daily?.time && forecastData.daily.time.length > 0 ? (
                          (forecastData.daily.time || []).map((date: string, i: number) => {
                            // Safely extract data with fallbacks
                            const weatherCode = forecastData.daily?.weather_code?.[i] ?? 0;
                            const windSpeed = (
                              forecastData.daily?.wind_speed_10m?.[i] || 
                              forecastData.daily?.wind_speed?.[i] || 
                              0
                            ).toFixed(1);
                            const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                            
                            // Robust weather icon mapping
                            const getWeatherIcon = (code: number) => {
                              const iconMap: { [key: number]: string } = {
                                0: 'wb_sunny',
                                1: 'wb_sunny',
                                2: 'cloud',
                                3: 'cloud',
                                45: 'cloud',
                                48: 'cloud',
                                51: 'grain',
                                53: 'grain',
                                55: 'grain',
                                61: 'rainy',
                                63: 'rainy',
                                65: 'rainy',
                                71: 'ac_unit',
                                73: 'ac_unit',
                                75: 'ac_unit',
                                77: 'ac_unit',
                                80: 'rainy',
                                81: 'rainy',
                                82: 'rainy',
                                85: 'ac_unit',
                                86: 'ac_unit',
                                95: 'thunderstorm',
                                96: 'thunderstorm',
                                99: 'thunderstorm'
                              };
                              return iconMap[code] || 'help_outline';
                            };
                            
                            const weatherIcon = getWeatherIcon(weatherCode);
                            
                            return (
                              <div 
                                key={date} 
                                className="flex flex-col items-center p-3 bg-gray-50 rounded-lg overflow-hidden w-full max-w-[150px]"
                              >
                                <p className="text-sm font-medium text-center max-w-full truncate">
                                  {day || 'Unknown'}
                                </p>
                                <span className="material-icons text-2xl my-2">
                                  {weatherIcon}
                                </span>
                                <div className="flex items-center">
                                  <span className="material-icons text-sm mr-1">air</span>
                                  <span className="text-xs max-w-[60px] truncate">
                                    {windSpeed} km/h
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-full text-center text-gray-500">
                            No forecast data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center p-6">
                <p>No forecast data available</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="historical" className="space-y-6">
            {historicalLoading ? (
              <Skeleton className="h-[400px] w-full rounded-lg" />
            ) : historicalData ? (
              <Card>
                <CardHeader>
                  <CardTitle className="overflow-hidden text-ellipsis whitespace-nowrap max-w-full truncate">Historical Weather Data</CardTitle>
                  <CardDescription className="overflow-hidden overflow-wrap-break-word text-ellipsis max-w-full line-clamp-2">Temperature and precipitation for the past 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveLineChart
                    data={formatHistoricalChartData(historicalData)}
                    lines={[
                      { key: 'temperature', color: '#1976d2', name: 'Temperature (°C)' },
                      { key: 'precipitation', color: '#43a047', name: 'Precipitation (mm)' },
                    ]}
                    height={350}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="text-center p-6">
                <p>No historical weather data available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Weather;
