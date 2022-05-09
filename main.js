import pip from 'point-in-polygon'
import jetpack from 'fs-jetpack'
import { union, polygon, multiPolygon, featureCollection } from '@turf/turf'

// console.log(`process.argv.length ${process.argv.length}`);
// process.argv.forEach((val, index) => {
//   console.log(`${index}: ${val}`);
// });

const geoFilename = (process.argv.length == 3 ? process.argv[2] : './nigeria.geojson.json')
const geo = jetpack.read(geoFilename, 'json')

const round3 = (x) => Math.round(x * 1000) / 1000
const zeroPad = (num, places) => String(num).padStart(places, '0')
const halfPixel = 0.025
const lengthPixel = 0.05

const features = geo.features

const geoJsonHead = {
  "type": "FeatureCollection",
  "name": "nigeria",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": []
}

const featureHead = {
  "type": "Feature",
  "properties": {
    "GID_0": "NGA",
    "NAME_0": "Nigeria",
    "cluster": null,
  },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": null
  }
}


const rectangle = (feature) => {
  let xMin = 0, yMin = 0, xMax = 0, yMax = 0
  feature.geometry.coordinates.map(poly => {
    poly.map(ring => {
      ring.map(([x, y]) => {
        xMin = xMin === 0 ? x : Math.min(x, xMin)
        yMin = yMin === 0 ? y : Math.min(y, yMin)
        xMax = Math.max(x, xMax)
        yMax = Math.max(y, yMax)
      })
    })
  })
  xMin = Math.trunc(xMin * 20.0) / 20.0
  yMin = Math.trunc(yMin * 20.0) / 20.0
  xMax = Math.trunc((xMax + 0.05) * 20.0) / 20.0
  yMax = Math.trunc((yMax + 0.05) * 20.0) / 20.0
  return {xMin, yMin, xMax, yMax}
}

const testPoly = (point, poly) =>
  poly.reduce((acc, ring, index) =>
      acc && (index === 0
          ? pip(point, ring) // outside
          : !pip(point, ring) // holes
      ),
    true
  )

const boundingBox = [9999.9, 9999.9, -9999.9, -9999.0]

const testFeature = (feature, db, clusters) => {
  const {xMin, yMin, xMax, yMax} = rectangle(feature)
  console.log(`Testing ${feature.properties.cluster} ${xMin}-${xMax}, ${yMin}-${yMax}`)
  
  if (xMin < boundingBox[0]) { boundingBox[0] = xMin; }
  if (yMin < boundingBox[1]) { boundingBox[1] = yMin; }
  if (xMax > boundingBox[2]) { boundingBox[2] = xMax; }
  if (yMax > boundingBox[3]) { boundingBox[3] = yMax; }

  for (let x = xMin; x < xMax; x += lengthPixel) {
    for (let y = yMin; y < yMax; y += lengthPixel) {
      feature.geometry.coordinates.map(poly => {
        if (testPoly([x + halfPixel, y + halfPixel], poly)) {
          const pixel = `${zeroPad(Math.round(y*1000), 5)}N${zeroPad(Math.round(x*1000), 5)}E`
          if (!db[pixel]) db[pixel] = []
          const { cluster } = feature.properties
          if (!db[pixel].includes(cluster)) {
            db[pixel].push(cluster);
            if (!clusters[cluster]) clusters[cluster] = []
            clusters[cluster].push([round3(x),round3(y)])
            if (db[pixel].length > 1) console.log(`OVERLAP: ${pixel}, ${db[pixel]}`)

            // log cluster pixel assignment
            console.log(`CLUSTER ${cluster} ${pixel}`)
          }
        }
      })
    }
  }
}

const testAll = (features, db, clusters) => features.map(feature => testFeature(feature, db, clusters))

const db = {}
const clusters = {}

testAll(features, db, clusters)

const createPixelPolySw = ([xSw, ySw]) => {
  const sw = [round3(xSw),               round3(ySw)]
  const se = [round3(xSw + lengthPixel), round3(ySw)]
  const ne = [round3(xSw + lengthPixel), round3(ySw + lengthPixel)]
  const nw = [round3(xSw),               round3(ySw + lengthPixel)]

  return [[sw, se, ne, nw, sw]]
}

const createMultipoly = (cluster, index) => {
  const mp = cluster.map(createPixelPolySw)
  const polysAsFeatures = mp.map(polygon)
  const feature = polysAsFeatures.slice(1).reduce((acc, feature) => union(acc, feature), polygon(mp[0]))
  feature.properties = {...featureHead.properties, cluster: index}
  return feature
}

const geoJsonArr = (clusters) => Object.keys(clusters).map((cluster, index) => createMultipoly(clusters[cluster], index + 1))
const geoJson = featureCollection(geoJsonArr(clusters))

console.log(`BOUNDING_BOX X_Y ${boundingBox}`)
console.log(`BOUNDING_BOX LAT_LONG latMin ${boundingBox[1]} longMin ${boundingBox[0]} latMax ${boundingBox[3]} longMax ${boundingBox[2]}`)

geoJson.name = 'Nigeria (simplified)'
geoJson.crs = geoJsonHead.crs

jetpack.write('aez.simplified.geojson', geoJson)
jetpack.write('db.json', db);
jetpack.write('cluster.json', clusters)
