import 'dotenv/config'
import axios from 'axios';
import pMap from 'p-map'
import jetpack from 'fs-jetpack'

const pixelSize = 0.05
const X_COORD = 0
const Y_COORD = 1
const throttle = 0.5

const round3 = (x) => Math.round(x * 1000) / 1000

const tomorrowBaseurl = 'https://api.tomorrow.io/v4'
const tomorrowTimelines = '/timelines'
const tomorrowAPIKEY = process.env.APIKEY
const tomorrowURL = (baseurl, endpoint, apikey) => `${baseurl}${endpoint}?apikey=${apikey}`
const tomorrowPOST = async (body) => (await axios.post(tomorrowURL(tomorrowBaseurl, tomorrowTimelines, tomorrowAPIKEY), body))
const wait = (throttle) => new Promise((resolve) => setTimeout(resolve, throttle))

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

/*
 a LineRing is an array of points where the first and last point are identical
 a Polygon is an array of LineRings.
 The first element is the outline, the following elements (if present) are "holes"
 a MultiPoly is an array of polygons.

1.  liegt zwischen 2 und 15 Grad östlicher Länge und 4 - 14 Grad nördlicher Breite.
2. Das ist ein Rechteck von 143 Quadratgrad.
3. Jeder Quadratgrad hat 400 Pixel von 0,05x0,05 Grad (Das ist die "Pula-Auflösung" also ca. 5,5*5,5km = 30km^2
4. Also bekommen wir 143*400 = 57200 Pixel
 */
// Nigeria containing Rectangle
const SW = [2.0, 4.0] //  [2.0, 4.0]
const NE = [3.0, 5.0] // [15.0, 14.0]

/**
 *
 * @param swx southWest x coordinate
 * @param swy southWest y coordinate
 * @returns a polygon.
 */
const pixelPoly = (swx, swy) => {
  return [
    [
      [round3(swx), round3(swy)],
      [round3(swx), round3(swy + pixelSize)],
      [round3(swx + pixelSize), round3(swy + pixelSize)],
      [round3(swx + pixelSize), round3(swy)],
      [round3(swx), round3(swy)]
    ]
  ]
}

/**
 *
 * @param swx southWest x coordinate
 * @param swy southWest y coordinate
 * @param limit
 * @param step
 * @returns a multipolygon
 */
const multiPoly = (swx, swy, limit = 10, step = pixelSize) => {
  const mp = [];
  for (let idx = 0; idx < limit; idx += 1) {
    mp.push(pixelPoly(swx + pixelSize * idx, swy))
  }
  return mp
}

const multipolys = () => {

  const mps = []
  const multiPolySizeX = 10 * pixelSize
  const multiPolySizeY = pixelSize
  const xSpan = NE[X_COORD] - SW[X_COORD]
  const ySpan = NE[Y_COORD] - SW[Y_COORD]
  const xCount = xSpan / multiPolySizeX
  const yCount = ySpan / multiPolySizeY

  for (let xIdx = 0; xIdx < xCount; xIdx += 1) {
    for (let yIdx = 0; yIdx < yCount; yIdx += 1) {
      mps.push(multiPoly(SW[X_COORD] + xIdx * multiPolySizeX, SW[Y_COORD] + yIdx * multiPolySizeY))
    }
  }

  return mps
}

const allSinglePolys = () => {

  const mps = []
  const xSpan = NE[X_COORD] - SW[X_COORD]
  const ySpan = NE[Y_COORD] - SW[Y_COORD]
  const xCount = xSpan / pixelSize
  const yCount = ySpan / pixelSize

  for (let xIdx = 0; xIdx < xCount; xIdx += 1) {
    for (let yIdx = 0; yIdx < yCount; yIdx += 1) {
      mps.push(pixelPoly(round3(SW[X_COORD] + xIdx * pixelSize), round3(SW[Y_COORD] + yIdx * pixelSize)))
    }
  }

  return mps


}
const geoJson = () => {

  const gJson = geoJsonHead
  const mps = multipolys()
  mps.map((multipoly, index) => {
    const feature = JSON.parse(JSON.stringify(featureHead))
    feature.properties.cluster = index
    feature.geometry.coordinates = multipoly
    gJson.features.push(feature)
  })

  return gJson

}

// fsj.write('./allpixels.geojson', geoJson())


const callSingle = async (poly, index) => {

  console.log('CallSingle -> ', index)
  const body = (poly) => ({
    "fields": [
      "rainAccumulation"
    ],
    "units": "metric",
    "timesteps": [
      "1h"
    ],
    "startTime": "2022-04-12T12:00:00Z",
    "endTime": "2022-04-13T12:00:00Z",
    "location": {
      "type": "Polygon",
      "coordinates": poly
    }
  })
  const res = await tomorrowPOST(body(poly))
  await wait(throttle)
  console.log('Callsingle <- ', index)
  return res
}


const callAll = async () => {
  const polys = allSinglePolys()
  const result = await pMap(polys, callSingle, {concurrency: 5})
  jetpack.write('allPixel.json', result)
}

callAll().then(() => console.log('done'))
