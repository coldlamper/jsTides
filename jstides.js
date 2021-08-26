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
          <div class="column">
            <div class="row header"></div>
            <div class="row tide-list"></div>
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

  tideRowsTemplate(data) { 
    
    let html = ''
    data.tideRows.forEach(row => {
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

  processTides(stationId) {
    
    let _self = this;
    return this.metadataStationRequest(stationId, 'json', null, null)
      .then(resp => {
        _self.station = resp.stations[0];

        const today = new Date();
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const beginDate = today.format('Ymd');
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
    
    this.state.date = stationDate.format('M j, Y g:i A')
    //let stationDate = new Date(this.state.date);
    
    let stationTimestamp = stationDate.getTime(); 
    let nextTideFound = false;
    
    this.state.tideRows = [];
    this.stationTides.predictions.every((prediction, index) => {
                 
      // If we have all the tides for the day truncate the array
			// Checking for nextTideFound will allow and extra tide(the next day's tide) to be displayed
			if (index > 3 && nextTideFound)
			{
				return false;
			}

			let predictionDt = new Date(new Date(prediction['t']).toLocaleString('en-US', {timeZone: stationTimezone}));
			let tideTimestamp = predictionDt.getTime();

			let nextTide = false;
			if ( stationTimestamp < tideTimestamp && !nextTideFound )
			{
				nextTide = true;
				nextTideFound = true;
			}

      this.state.tideRows.push()

			// Format the time output
			let localTime = predictionDt.format('g:i A');

			this.state.tideRows.push({
        localTime: localTime,
        nextTide: nextTide,
        height: prediction['v'],
        tideType: prediction['type'] == 'L' ? 'Low' : 'High'
      });

      return true;
      
    })
     
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
    this.renderTemplate('tideRows');
       
  }
  
  renderTemplate(template, selector) {
    
    let htmlObj = this[template + 'Template'](this.state)
    
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