'use strict';
const qiniu = require("qiniu")

const ZoneMap = {
  "Zone_z0": qiniu.zone.Zone_z0,
  "Zone_z1": qiniu.zone.Zone_z1,
  "Zone_z2": qiniu.zone.Zone_z2,
  "Zone_na0": qiniu.zone.Zone_na0,
}

module.exports = {
  provider: 'qiniu',
  name: 'Qiniu Storage Service',
  auth: {
    accessKey: {
      label: 'Access API Token',
      type: 'text'
    },
    secretKey: {
      label: 'Secret Access Token',
      type: 'text'
    },
    zone: {
      label: 'Region',
      type: 'enum',
      values: Object.keys(ZoneMap)
    },
    bucket: {
      label: 'Bucket',
      type: 'text'
    },
    bindDomain: {
      label: 'BindDomain',
      type: 'text'
    },
    // If you open the original image protection, you can configure a default image processing style.
    defaultImageStyle: {
      label: 'default Image processing Style. (for original image protection opened)',
      type: 'text'
    }
  },
  init: (qiniuConfig) => {
    const bucket = qiniuConfig.bucket
    const bindDomain = qiniuConfig.bindDomain

    const zoneConfig = new qiniu.conf.Config()
    zoneConfig.zone = ZoneMap[qiniuConfig.zone] || qiniu.zone.Zone_z2
    const formUploader = new qiniu.form_up.FormUploader(zoneConfig)

    qiniu.conf.ACCESS_KEY = qiniuConfig.accessKey
    qiniu.conf.SECRET_KEY = qiniuConfig.secretKey
    const mac = new qiniu.auth.digest.Mac(qiniuConfig.accessKey, qiniuConfig.secretKey)

    return {
      upload: (file) => {
        return new Promise((resolve, reject) => {
          const key = `${file.hash}${file.ext}`
          const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${key}` })
          const uploadToken = putPolicy.uploadToken(mac)
          const putExtra = new qiniu.form_up.PutExtra()

          formUploader.put(uploadToken, key, new Buffer(file.buffer, 'binary'), putExtra, (err, body, info) => {
            if (err) {
              return reject(err)
            }

            if (info.statusCode === 200) {
              // set the bucket file url
              file.url = `${bindDomain}/${key}`;

              // append image processing style
              if (file.mime && file.mime.startsWith('image/') &&  qiniuConfig.defaultImageStyle) {
                file.url = `${file.url}${qiniuConfig.defaultImageStyle}`
              }
              return resolve()
            } else {
              return reject(err)
            }
          })
        });
      },
      delete: (file) => {
        return new Promise((resolve, reject) => {
          const bucketManager = new qiniu.rs.BucketManager(mac, zoneConfig);
          const key = `${file.hash}${file.ext}`
          bucketManager.delete(bucket, key, function(err, respBody, respInfo) {
            if (err) {
              return reject(err)
            }

            resolve();
          });
        });
      }
    };
  }
};