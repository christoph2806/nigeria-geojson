
# AEZ Simplification

Original AEZ for Nigeria are defined in KML format.
The original AEZ include detailed boundaries along water ways and coast line.

The original AEZ are transformed into simplified AEZ in GeoJSON format that consist of sets of pixels where each pixel is an area defined by a 0.05° x 0.05° area.
Pixels always include the complete 0.05° x 0.05° area independent of water ways or coast lines.

## QGIS KML <-> GeoJSON Conversion

* [QGIS homepage](https://www.qgis.org/)

Process

* Input file: `Nigeria201Nigeria_Clusters.kml`
* Output file:  `Nigeria_Clusters.geojson`

Step by step:

1. Start QGIS
1. In QGIS Browser view open `Nigeria201Nigeria_Clusters.kml`
1. Below the kml file double click on `Nigeria_Clusters`
1. This creates the entry `Nigeria_Clusters` in the QGIS Layers view
1. Right click on this entry and choose `Export | Save Features as ...`
1. This opens the `Save Vector Layer as ...` dialogue

In dialogue `Save Vector Layer as ...` select the following 

* Format: `GeoJSON`
* File name: Choose `Nigeria_Clusters.geojson`
* CRS: `EPSG4326 - WGS 84`
* Select fields to export
    * GID_0
    * NAME_0
    * cluster


## Run GeoJSON Simplification

Process

* Input file: `Nigeria_Clusters.geojson`
* Output files:
    * `aez.simplified.geojson` simplified AEZ definitions
    * `db.json`
    * `cluster.json`

Step by step:

1. Install dependencies
1. Run simplification script

```bash
npm install
node main.js Nigeria_Clusters.geojson
```

## Create Simplified MKL

Process

* Input file: `aez.simplified.geojson`
* Output file: `aez.simplified.kml`

Step by step:

1. Install `tokml` from [mapbox](https://github.com/mapbox/tokml)
1. Convert GeoJSON file to KML via command line tool
1. View KML file in browser, eg. [Google Earth](https://earth.google.com)

```bash
npm install -g tokml
tokml aez.simplified.geojson > aez.simplified.kml
```

## Create Simplified AEZ - Pixel Assigments

Create assigment file
```bash
node main.js Nigeria_Clusters.geojson | grep 'CLUSTER ' > aez.simplified.pixels.txt
```

Show assignments
```bash
head aez.simplified.pixels.txt
CLUSTER 1 10050N04300E
CLUSTER 1 09950N04350E
CLUSTER 1 10000N04350E
CLUSTER 1 10050N04350E
CLUSTER 1 10100N04350E
...
```

Line format is `CLUSTER <cluster-id> <pixel-id>`:

* cluster-id integer in [1 .. 201]
* pixel-id `<latitude>N<longitude>E`
* pixel-id represents the SW corner of the 0.05° x 0.05° sized pixel
* latitude and longitude are 5 digit numbers with the 2 most significant digits represent degrees and the remaining digits fractions of degrees

Example:

* pixel-id: 10050N04300E
* Latitude: 10.05°N (10°3'N)
* Longitude: 4.30°E (4°18'E)
