import { execFileSync } from "node:child_process";
// Explicitly used by live checks / local preview only. Never print or persist values.
export function readMapsCredentials() {
  const output = execFileSync("C:/Users/ban357/AppData/Local/Python/pythoncore-3.14-64/python.exe", ["-c", "import json,keyring; print(json.dumps({'NAVER_MAPS_CLIENT_ID':keyring.get_password('naver_maps','client_id'),'NAVER_MAPS_CLIENT_SECRET':keyring.get_password('naver_maps','client_secret'),'KAKAO_REST_API_KEY':keyring.get_password('nearby_maps','kakao_rest_api_key')}))"], { encoding: "utf8" });
  const values = JSON.parse(output);
  if (Object.values(values).some(value => !value || !String(value).trim())) throw new Error("Required Windows credentials are missing");
  return values;
}
