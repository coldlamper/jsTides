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

  constructor(selector) {
    
    this.init(selector);
  
  }

  mainTemplate(data) { 
    
    return {
      selector: '#main',
      html:`
      <div class="jsTides">
            
          <div class="row">
            <div class="column">
              <div class="row header"></div>
              <div class="row tide-list"></div>
            </div>

            <div class="column map_container">
              <div id="map" style="width:400px;height:300px"></div>    
            </div>

          </div>

        </div>
      `
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

  getDateFormatted(dateObj, format = 'yyyymmdd') {
   
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); //January is 0!
    const yyyy = dateObj.getFullYear();
    
    const hours24 = dateObj.getHours();
    let hours = (hours24 - 12) > 0 ? hours24 - 12 : hours24;
    if (hours == 0) hours = 12;
    const g = hours;
    const i = String(dateObj.getMinutes()).padStart(2, '0');
    const A = hours24 > 11 ? 'PM' : 'AM';
    
    let formatted = format;
    formatted = formatted.replace('yyyy', yyyy);
    formatted = formatted.replace('mm', mm);
    formatted = formatted.replace('dd', dd);
    formatted = formatted.replace('g', g);
    formatted = formatted.replace('i', i);
    formatted = formatted.replace('A', A);
    return formatted;

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

        console.log(_self.station);
        const today = new Date();
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const beginDate = _self.getDateFormatted(today);
        const endDate = _self.getDateFormatted(tomorrow);

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

    //TODO Some stations don't have a timezone
    let stationTimezone = this.timezones[this.station.timezone];
    this.state.date = new Date().toLocaleString('en-US', {timeZone: stationTimezone});
    let stationDate = new Date(this.state.date);
    let stationTimestamp = stationDate.getTime() / 1000; 
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
			let tideTimestamp = predictionDt.getTime() / 1000;

			let nextTide = false;
			if ( stationTimestamp < tideTimestamp && !nextTideFound )
			{
				nextTide = true;
				nextTideFound = true;
			}

      this.state.tideRows.push()

			// Format the time output
			let localTime = this.getDateFormatted(predictionDt, 'g:i A');

			this.state.tideRows.push({
        localTime: localTime,
        nextTide: nextTide,
        height: prediction['v'],
        tideType: prediction['type'] == 'L' ? 'Low' : 'High'
      });
      
      return true;
      
    })
     
  }

  createMap(lat, long, zoom) {
    
    this.map = L.map('map').setView([30.505, -95.09], 3);

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
      .on('click', () => onClick());

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

  init(selector) {
    
    this.renderTemplate('main', selector);
    this.render();
    this.getStations()
      .then(tides => {
        tides.createMap(30.505, -95.09, 3);
        for ( let i = 0; i < tides.stations.length; i++ ) {
          let container = '<div>';
          container += 'Station ID - ' + tides.stations[i].id + '<br>' + tides.stations[i].name + '</div>';
          tides.createCircleMarker(tides.stations[i].lat, tides.stations[i].lng, container, () => {
            this.state.title = tides.stations[i].name + ' (' + tides.stations[i].id + ')' ; 
            tides.processTides(tides.stations[i].id)
              .then(tides => {
                this.render()
              })
          })
        }
      })
    };

 }





