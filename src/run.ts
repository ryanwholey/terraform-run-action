
import axios from 'axios'
import { TerraformInstance } from './lib/terraform'
import * as fs from 'fs'
import tar from 'tar'

interface Result {
  runUrl: string
  plan?: string
}

export async function run({
  organization,
  workspace,
  contentDirectory,
  speculative = true,
  host = 'app.terraform.io',
} : {
  organization: string,
  workspace: string,
  contentDirectory: string,
  speculative?: boolean,
  host?: string
}, {
  terraform: tf
}: {
  terraform: TerraformInstance
}): Promise<Result> {
  const result: Result = {runUrl: ''}

  const ws = await tf({
    url: `/api/v2/organizations/${organization }/workspaces/${workspace}`,
    method: 'get',
  })
  const workspaceId = ws.data.data.id

  const cv = await tf({
    url: `/api/v2/workspaces/${workspaceId}/configuration-versions`,
    method: 'post',
    data: {
      data: {
        type: 'configuration-versions',
        attributes: {
          'auto-queue-runs': false,
          speculative,
        }
      }
    }
  })

  const zip = `/tmp/content-${new Date().getTime()}.tar.gz`

  await tar.c({
    gzip: true,
    file: zip,
    C: contentDirectory
  }, ['.'])

  await axios({
    method: 'put',
    url: cv.data.data.attributes['upload-url'],
    data: fs.readFileSync(zip),
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  })

  let pollForUpload = true
  while (pollForUpload) {
    const upload = await tf({
      url: `/api/v2/configuration-versions/${cv.data.data.id}`
    })

    switch (upload.data.data.attributes.status) {
      case 'errored': {
        throw new Error(upload.data.data.attributes['error-message'])
      }
      case 'uploaded': {
        console.error('Upload: finished')
        pollForUpload = false
        break
      }
      default: {
        console.error('Upload: processing...')
        await new Promise(res => setTimeout(res, 1000))
      }
    }
  }

  const run = await tf({
    url: `/api/v2/runs`,
    method: 'post',
    data: {
      data: {
        attributes: {
          message: "Custom message"
        },
        type: 'runs',
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: workspaceId,
            }
          },
          'configuration-version': {
            data: {
              type: 'configuration-versions',
              id: cv.data.data.id
            }
          }
        }
      }
    }
  })

  result.runUrl = `https://${host}/app/${organization}/workspaces/${workspace}/runs/${run.data.data.id}`
  console.error(`Run: Queued ${result.runUrl}`)

  if (speculative) {
    let pollForRun = true
    let runStatus

    while (pollForRun) {
      runStatus = await tf({
        url: `/api/v2/runs/${run.data.data.id}`,
        method: 'get',
      })
  
      console.error(`Plan: ${runStatus.data.data.attributes.status}`)
  
      if ([
        'policy_soft_failed',
        'planned_and_finished',
        'discarded',
        'errored',
        'planned' // not a final state, but we can treat it like one to let the workspace or user handle the apply
      ].includes(runStatus.data.data.attributes.status)) {
        pollForRun = false
      }
  
      await new Promise((res) => setTimeout(res, 1000))
    }
  
    if (!runStatus) {
      throw new Error('Run could not be found')
    }
  
    const plan = await tf({
      url: runStatus.data.data.relationships.plan.links.related,
      method: 'get',
    })
  
    const output = await axios({
      url: plan.data.data.attributes['log-read-url'],
    })
  
    result.plan = output.data.data
  }

  return result
}
