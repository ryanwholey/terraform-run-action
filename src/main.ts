import * as core from '@actions/core'
import { run } from './run'
import { terraform, TerraformOptions, TerraformInstance } from './lib/terraform'

async function main(): Promise<void> {
  try {
    const result = await run({
      organization: core.getInput('organization'),
      workspace: core.getInput('workspace'),
      contentDirectory: core.getInput('content-directory'),
      speculative: true
    }, {
      terraform: terraform({
        token: core.getInput('token'),
        host: core.getInput('host')
      } as TerraformOptions) as TerraformInstance
    })

    core.setOutput('plan', result.plan)
    core.setOutput('runUrl', result.runUrl)

    console.log(result.plan)
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
