// Install Minio library.
// $ npm install -g minio
//
// Import Minio library.
var Minio = require('minio')

// Instantiate the minio client with the endpoint
// and access keys as shown below.
var minioClient = new Minio.Client({
    endPoint: '71an.com',
    port: 4100,
    secure: false,
    accessKey: 'FDGNNW15QWK9F237VIXS',
    secretKey: '4wXenRDClmg3MBUxHN49YjjvwSuqEgyBY67MIxy6'
});

// File that needs to be uploaded.
var file = '/abc/kevio/test/ok.js'

// Make a bucket called europetrip.
minioClient.makeBucket('europetrip', 'us-east-1', function(err) {
    if (err) return console.log(err)

    console.log('Bucket created successfully in "us-east-1".')

    // Using fPutObject API upload your file to the bucket europetrip.
    minioClient.fPutObject('europetrip', 'ok.js', file, 'application/octet-stream', function(err, etag) {
        if (err) return console.log(err)
            console.log('File uploaded successfully.')
    });
});