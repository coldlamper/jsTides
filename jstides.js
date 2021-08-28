class jsTides {

  timezones = {
    AST: 'America/New_York',
    EST: 'America/New_York',
    CST: 'America/Chicago',
    MST: 'America/Denver',
    PST: 'America/Los_Angeles',
    AKST: 'America/Anchorage',
    HST: 'Pacific/Honolulu',
  };

  stations = {};
  station = {};
  stationTides = {};

  noaaCoOpsMetadataApiUrl = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations';
  noaaCoOpsDataApiUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

  templateSelectors = {};

  state = {
    title: 'Select a station on the map',
    date: '',
    tideRows: [],
    nextTide: {}
  }

  constructor(selector, stationId = '') {

    this.stationId = stationId;
    this.showMap = stationId ? false : true;
    this.selector = selector

    if (this.showMap) {
      this.loadAsset('https://unpkg.com/leaflet@1.7.1/dist/leaflet.css')
        .catch(err => {
          console.log('Error loading Leaflet CSS', err);
        }); 
        this.loadAsset('https://unpkg.com/leaflet@1.7.1/dist/leaflet.js')
        .then(() => { this.initRender() } )
        .catch(err => {
          console.log('Error loading Leaflet JS', err);
        }); 
    } else {
      this.initRender()
    }
    
  }

  mainTemplate(data) { 
    
    let html = `
      <div class="jsTides">
        <div class="row">
          <div class="column previous-day">
            <div class="row"><</div>
          </div>
          <div class="column">
            <div class="row header"></div>
            <div class="row tide-list"></div>
            <div class="row tide-graph"></div>
          </div>
          <div class="column next-day">
            <div class="row">></div>
          </div>
      `;
    
    if (this.showMap) {
      html += `
          <div class="column map_container">
            <div id="map" style="width:400px;height:300px"></div>    
          </div>
      `;
    }

    html += `
        </div>

      </div>
    `; 

    return {
      selector: '#main',
      html: html
    };

  }

  headerTemplate(data) {
    
    return {
      selector: '.jsTides .header',
      html: `
        <div class="column">
          <div class="row">
            <div class="column">${data.title}</div>
          </div>
          <div class="row">
            <div class="column">${data.date}</div>
          </div>
      </div>
      `
    };

  }

  tideRowsTemplate(rows) { 
    
    let html = ''
    rows.forEach(row => {
      let nextTideClass = row.nextTide ? ' next-tide' : '' 
      html += `
      <div class="row${nextTideClass}">
        <div class="column">${row.localTime}</div>
        <div class="column">${row.tideType}</div>
        <div class="column">${row.height} ft.</div>
      </div>    
      `;
    })

    return {
      selector: '.jsTides .tide-list',
      html: html
    }

  }
  
  makeRequest(url) {
    
    return fetch(url)
      .then(data => { return data.json() })
      .catch(err => { console.log(err) });
  
  }

  metadataStationRequest(stationId = null, extension = 'json', resource = '', type = 'tidepredictions') {
    
    let url = this.noaaCoOpsMetadataApiUrl;
    if (stationId) {
      url += '/' + stationId;
      if (resource) {
        url += '/' + resource;
      }
    }

    url += '.' + extension;
    if (type) {
      url += '?type=' + type;
    }

    return this.makeRequest(url);

  }

  dataRequest(requestParams) {

    let url = this.noaaCoOpsDataApiUrl;
    let queryString = new URLSearchParams(requestParams).toString();
    url += '?' + queryString;

    return this.makeRequest(url);

  }

  getStations() {
    
    return this.metadataStationRequest()
      .then(resp => {
        this.stations = resp.stations;
        return this;
      });

  }

  processTides(stationId, dateObj = null) {
    
    let _self = this;
    return this.metadataStationRequest(stationId, 'json', null, null)
      .then(resp => {
        _self.station = resp.stations[0];

        const today = new Date();
       
        const yesterday =  new Date(today);
        yesterday.setDate(yesterday.getDate() - 1)
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1)

        const beginDate = yesterday.format('Ymd');
        const endDate = tomorrow.format('Ymd');

        const params = {
          product: 'predictions',
          begin_date: beginDate,
          end_date: endDate,
          datum: 'MLLW',
          station: stationId,
          time_zone: 'lst_ldt',
          units: 'english',
          interval: 'hilo',
          format: 'json',
          application: 'jsTides'
        };

        return this.dataRequest(params)
          .then(res => { 
             console.log(res); 
            _self.stationTides = res; 
            this.formatJsonTidePreditions();
            return _self; 
          })
      })

  }

  formatJsonTidePreditions() {

    //TODO Some stations don't have a timezone, need to somehow use offsets
    let stationTimezone = this.timezones[this.station.timezone];
    let stationDate = new Date((new Date().toLocaleString('en-US', {timeZone: stationTimezone})));
    
    let localTimeZoneOffset = new Date().getTimezoneOffset(); // Get local timezone offset in minutes reguardless of timezone set to date object

    this.state.date = stationDate.format('M j, Y g:i A')
    
    let stationTimestamp = stationDate.getTime(); 
    let nextTideFound = false;
    
    this.state.tideRows = [];
    this.stationTides.predictions.every((prediction, index) => {
      
      let lastTideRowWIsNextTide = false;
      if(this.state.tideRows.length > 1) {
        lastTideRowWIsNextTide = this.state.tideRows[this.state.tideRows.length - 1].nextTide;
      }  
      
      let endView = false;
     
			if (index > 8 && nextTideFound && lastTideRowWIsNextTide !== true)
			{
         endView = true;
      }
      let startView = false;
      if (index == 3) {
        startView = true;
      }

    	let predictionDt = new Date(new Date(prediction['t']).toLocaleString('en-US', {timeZone: stationTimezone}));
			let tideTimestamp = predictionDt.getTime();

			let nextTide = false;
			if ( stationTimestamp < tideTimestamp && !nextTideFound )
			{
				nextTide = true;
       	nextTideFound = true;
      }

			// Format the time output
			let localTime = predictionDt.format('g:i A');

			this.state.tideRows.push({
        timestamp: tideTimestamp - (localTimeZoneOffset * 60 * 1000),
        localTime: localTime,
        nextTide: nextTide,
        height: prediction['v'],
        tideType: prediction['type'] == 'L' ? 'Low' : 'High',
        startView: startView,
        endView: endView
      });

      if (nextTide) {
        this.state.nextTide = this.state.tideRows.slice(-1)[0];
      }

      return true;
      
    })
     
  }

  createGraph() {
    
    if (this.hasOwnProperty('chart')) {
      this.chart.destroy();
    }
    
    let data = [];
    let categories = [];

    let i = 0;
    let useRow = false;
    this.state.tideRows.forEach( row => {
      if (row.startView === true) {
        useRow = true;
      }
      
      if (row.endView === true) {
        useRow = false;
      } 

      if (useRow) {
        data.push(row.height);
        categories.push(row.timestamp);
      }
      
    });
    
    let options = {
      chart: {
        type: "area",
        height: 200,
        toolbar: {
          show: false,
        },
        parentHeightOffset:0,
        dropShadow: {
          enabled: false,
          enabledSeries: [0],
          top: -2,
          left: 2,
          blur: 5,
          opacity: 0.06
        },
       },
      stroke: {
        curve: "smooth",
        width: 2
      },
      dataLabels: {
        enabled: false,
        formatter: function(value, { seriesIndex, dataPointIndex, w }) {
          return w.config.series[seriesIndex].name + ":  " + value
        }
      },
      series: [{
        name: 'Height',
        data: data
      }],
      markers: {
        size: 0,
        strokeColor: "#fff",
        strokeWidth: 3,
        strokeOpacity: 1,
        fillOpacity: 1,
        hover: {
          size: 6
        }
      },
      xaxis: {
        categories: categories,
        type: 'category',
        axisBorder: {
          show: false
        },
        axisTicks: {
          show: false
        },
        tooltip: {
          enabled: false
        },
        labels: {
          offsetX: 0,
          offsetY: -5,
          formatter: function (value) {
            let date = new Date(value);
            let utcTimeStamp = (date.getTime() + date.getTimezoneOffset()*60*1000)
            return new Date(utcTimeStamp).format('g:i A');
          }
        }
      },
      yaxis: {
        labels: {
          offsetX: -12,
          offsetY: -5,
          formatter: function (value) {
            return value.toFixed(1) + ' ft';
          }
        },
        tooltip: {
          enabled: true
        }
      },
      grid: {
        padding: {
          left: -5,
          right: 5
        }
      },
      tooltip: {
        x: {
          formatter: function (value) {
            let date = new Date(categories[value - 1]);
            let utcTimeStamp = (date.getTime() + date.getTimezoneOffset()*60*1000)
            return new Date(utcTimeStamp).format('M d g:i A');
          }
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left'
      },
      fill: {
        type: "gradient",
        opacityFrom: 1,
        opacityTo: 0.2,
      },
      annotations: {
        xaxis: [
          {
            x: this.state.nextTide.localTime,
            borderColor: '#775DD0',
            label: {
              style: {
                color: '#00f',
              },
              text: 'Next Tide'
            }
          }
        ]
      }

    };

    this.chart = new ApexCharts(document.querySelector(".tide-graph"), options);

    this.chart.render();
       
  }

  createMap(lat, lng, zoom) {
    
    this.map = L.map('map').setView([lat, lng], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(this.map);

    this.mapRenderer = L.canvas({ padding: 0.5 });
  
  }

  createCircleMarker(lat, lng, toolTip, onClick) {
    
    return L.circleMarker([lat, lng], {
      renderer: this.mapRenderer,
      radius: 4,
    }).addTo(this.map)
      .bindTooltip(toolTip)
      .on('click', (e) => onClick(e));

  }

  render() {
    
    this.renderTemplate('header');

    if (this.state.tideRows.length) {
      
      let rows = [];
      
      let useRow = false;
      [...this.state.tideRows].forEach(row => {
      
        if (row.startView === true) {
          useRow = true;
        }
          
        if (row.endView === true) {
          useRow = false;
        } 
    
        if (useRow) {
          rows.push(row);
        }

      });
      
      rows.pop();
      rows.shift();

      this.renderTemplate('tideRows', false, rows);
    
      this.createGraph();

     }
           
  }
  
  renderTemplate(template, selector, data = null) {
    
    if (!data) {
      data = this.state;
    }
    
    let htmlObj = this[template + 'Template'](data)
    
    if (selector) {
      htmlObj.selector = selector; 
    }  

    let elements = document.querySelectorAll(htmlObj.selector)
    elements.forEach(element => {
      element.innerHTML = htmlObj.html;
    });
    
  }

  loadAsset(src) {
    return new Promise((resolve, reject) => {
      
      // get file extention to determine type
      const ext  = src.split('.').pop();
      const elementTypes = {
        js: 'script',
        css: 'link'
      }
      let type = elementTypes[ext];
      
      let asset = document.createElement(type);
      
      // Add type specific attributes
      if (type === 'script') {
        asset.src = src;
      } else if (type === 'link') {
        asset.rel = 'stylesheet';
        asset.href = src;
      }

      // Add common attributes
      asset.async = true;
      asset.onload = resolve;
      asset.onerror = reject;
      
      document.head.appendChild(asset);
    
    });
  }

   initRender() { 
    this.renderTemplate('main', this.selector);
    this.render();
    this.getStations()
      .then(tides => {
        if (this.showMap) {
          tides.createMap(30.505, -95.09, 3);
          for ( let i = 0; i < tides.stations.length; i++ ) {
            let container = '<div>';
            container += 'Station ID - ' + tides.stations[i].id + '<br>' + tides.stations[i].name + '</div>';
            tides.createCircleMarker(tides.stations[i].lat, tides.stations[i].lng, container, (e) => {
              tides.map.setView(e.target.getLatLng(), 12);
              this.state.title = tides.stations[i].name + ' (' + tides.stations[i].id + ')' ; 
              tides.processTides(tides.stations[i].id)
                .then(tides => {
                  this.render()
                })
            })
          }
        }
        else {
          tides.processTides(tides.stationId)
            .then(tides => {
              this.render()
            })
        }
      })
    };

 }