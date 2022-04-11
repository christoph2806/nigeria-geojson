const pip = require('point-in-polygon')
const fs = require('fs-jetpack')

const geo = require('./nigeria.geojson.json')

const features = geo.features

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

const testFeature = (feature, db) => {
  const {xMin, yMin, xMax, yMax} = rectangle(feature)
  console.log(`Testing ${feature.properties.cluster} ${xMin}-${xMax}, ${yMin}-${yMax}`)

  for (let x = xMin + 0.005; x < xMax; x += 0.05) {
    for (let y = yMin + 0.005; y < yMax; y += 0.05) {
      feature.geometry.coordinates.map(poly => {
        if (testPoly([x,y], poly)) {
          const pixel = Math.trunc(Math.trunc(x*200)*1000 + Math.trunc(y*200))
          if (!db[pixel]) db[pixel] = []
          const { cluster } = feature.properties
          if (!db[pixel].includes(cluster)) {
            db[pixel].push(cluster);
            if (db[pixel].length > 1) console.log(`OVERLAP: ${pixel}, ${db[pixel].length}`)
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



const testAll = (features, db) => features.map(feature => testFeature(feature, db))

const db = {}
testAll(features, db)
const file = 'db.json'
console.log(Object.keys(db).length)
fs.write(file, JSON.stringify(db, null, 2));

const geojson = {
  "type": "FeatureCollection",
  "name": "nigeria",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  }
}



/*

features.map(feature => {
  const type = feature.geometry.type

  const countRingsPoints = (polygon) => {
    let points = 0
    polygon.map(ring => points += ring.length)
    return {points, rings: polygon.length}
  }
  let polys;
  let rings = 0;
  let points = 0;
  polygons = feature.geometry.coordinates
  if (type === 'MultiPolygon') {
    polygons.map(polygon => {
      const {points: p, rings: r} = countRingsPoints(polygon)
      rings += r
      points += p
    })
    polys = polygons.length
  } else {
    ({points, rings} = countRingsPoints(polygons))
    polys = 1
  }

  console.log(`${feature.geometry.type} : ${feature.properties.cluster} : ${polys} : ${rings} : ${points}`)

})

 */
