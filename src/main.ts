import * as core from '@actions/core'
import { run } from './run'

async function main(): Promise<void> {
  try {

    const result = await run({
      token: process.env.TFE_TOKEN as string,
      organization: process.env.TFE_ORGANIZATION as string,
      workspace: process.env.TFE_WORKSPACE as string,
      contentDirectory: process.env.TFE_CONTENT_DIRECTORY as string,
      speculative: true
    })

    core.setOutput('plan', result.plan)
    core.setOutput('runUrl', result.runUrl)

    console.log(result.plan)
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
