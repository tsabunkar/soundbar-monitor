const { execSync } = require('child_process')

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[afterPack] Re-signing ${appPath} with ad-hoc signature...`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
  console.log('[afterPack] Ad-hoc signing complete')
}
