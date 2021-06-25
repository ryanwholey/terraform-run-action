import axios, { AxiosInstance } from 'axios'

export interface TerraformOptions {
  token: string,
  host: string,
}

export {AxiosInstance as TerraformInstance}

export function terraform ({ token, host = 'app.terraform.io' } : TerraformOptions): AxiosInstance {
  return axios.create({
    baseURL: `https://${host}`,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${token}`,
    }
  })
}
