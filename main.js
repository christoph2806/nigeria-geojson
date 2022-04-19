import pip from 'point-in-polygon'
import jetpack from 'fs-jetpack'
import { union, polygon, multiPolygon, featureCollection } from '@turf/turf'

const geo = jetpack.read('./nigeria.geojson.json', 'json')
const round3 = (x) => Math.round(x * 1000) / 1000
const halfPixel = 0.025

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

const testFeature = (feature, db, clusters) => {
  const {xMin, yMin, xMax, yMax} = rectangle(feature)
  console.log(`Testing ${feature.properties.cluster} ${xMin}-${xMax}, ${yMin}-${yMax}`)

  for (let x = xMin + 0.025; x < xMax; x += 0.05) {
    for (let y = yMin + 0.025; y < yMax; y += 0.05) {
      feature.geometry.coordinates.map(poly => {
        if (testPoly([x,y], poly)) {
          const pixel = Math.trunc(Math.trunc(x*10000)*100000 + Math.trunc(y*10000))
          if (!db[pixel]) db[pixel] = []
          const { cluster } = feature.properties
          if (!db[pixel].includes(cluster)) {
            db[pixel].push(cluster);
            if (!clusters[cluster]) clusters[cluster] = []
            clusters[cluster].push([round3(x),round3(y)])
            if (db[pixel].length > 1) console.log(`OVERLAP: ${pixel}, ${db[pixel]}`)
            // console.log(`db.${pixel} -> ${cluster}`)
          }
        }
      })
    }
  }
}

/*
console.log(testPoly(
  [0.3,0.3],
  [
    [[0,0], [2,0], [2,2], [0,2], [0,0]], // outline
    [[0.1,0.1], [0.5,0.1], [0.5,0.5], [0.1,0.5], [0.1,0.1]]  // hole
  ]))
*/



const testAll = (features, db, clusters) => features.map(feature => testFeature(feature, db, clusters))

const db = {}
const clusters = {}

testAll(features, db, clusters)

const createPixelPoly = ([xMiddle, yMiddle]) => {
  const sw = [round3(xMiddle - halfPixel),round3( yMiddle - halfPixel)]
  const se = [round3(xMiddle + halfPixel),round3( yMiddle - halfPixel)]
  const ne = [round3(xMiddle + halfPixel),round3( yMiddle + halfPixel)]
  const nw = [round3(xMiddle - halfPixel),round3( yMiddle + halfPixel)]

  return [[sw, se, ne, nw, sw]]
}

const createMultipoly = (cluster, index) => {
  const mp = cluster.map(createPixelPoly)
  const polysAsFeatures = mp.map(polygon)
  const feature = polysAsFeatures.slice(1).reduce((acc, feature) => union(acc, feature), polygon(mp[0]))
  feature.properties = {...featureHead.properties, cluster: index}
  return feature
}

const geoJsonArr = (clusters) => Object.keys(clusters).map((cluster, index) => createMultipoly(clusters[cluster], index + 1))
const geoJson = featureCollection(geoJsonArr(clusters))

geoJson.name = 'Nigeria (simplified)'
geoJson.crs = geoJsonHead.crs

jetpack.write('all.geojson', geoJson)
jetpack.write('db.json', db);
jetpack.write('cluster.json', clusters)

