import sys
import urllib.request
import urllib.parse
import json


def fetch_weather(location: str | None = None) -> dict:
    # WTTR.IN provides simple weather info without API key.
    base = 'https://wttr.in/'
    query = '' if not location else urllib.parse.quote(location)
    url = f'{base}{query}?format=j1'
    with urllib.request.urlopen(url, timeout=15) as resp:
        return json.load(resp)


def format_weather(data: dict) -> str:
    # Extract useful info
    area = data.get('nearest_area', [{}])[0].get('areaName', [{}])[0].get('value', 'Unknown')
    region = data.get('nearest_area', [{}])[0].get('region', [{}])[0].get('value', '')
    country = data.get('nearest_area', [{}])[0].get('country', [{}])[0].get('value', '')

    current = data.get('current_condition', [{}])[0]
    temp_c = current.get('temp_C', '?')
    feels_like_c = current.get('FeelsLikeC', '?')
    weather_desc = current.get('weatherDesc', [{}])[0].get('value', '')
    humidity = current.get('humidity', '?')
    wind_kph = current.get('windspeedKmph', '?')
    wind_dir = current.get('winddir16Point', '?')

    today = data.get('weather', [{}])[0]
    avgtemp_c = today.get('avgtempC', '?')
    maxtemp_c = today.get('maxtempC', '?')
    mintemp_c = today.get('mintempC', '?')
    hourly = today.get('hourly', [])

    result = []
    result.append(f"地点: {area} {region} {country}".strip())
    result.append(f"当前: {weather_desc}, 体感 {feels_like_c}°C, 温度 {temp_c}°C")
    result.append(f"湿度: {humidity}%  风: {wind_kph} km/h ({wind_dir})")
    result.append(f"今天: 平均 {avgtemp_c}°C, 最高 {maxtemp_c}°C, 最低 {mintemp_c}°C")

    if hourly:
        # Show next few timepoints
        entries = []
        for rec in hourly[:3]:
            time = int(rec.get('time', 0))
            hh = f"{time//100:02d}:{time%100:02d}" if time != 0 else "00:00"
            desc = rec.get('weatherDesc', [{}])[0].get('value', '')
            temp = rec.get('tempC', '?')
            entries.append(f"  {hh} {desc} {temp}°C")
        result.append("近期预报:\n" + "\n".join(entries))

    return "\n".join(result)


if __name__ == '__main__':
    location = None
    if len(sys.argv) > 1:
        location = ' '.join(sys.argv[1:])
    try:
        data = fetch_weather(location)
    except Exception as e:
        print('获取天气失败:', e)
        sys.exit(1)

    print(format_weather(data))
