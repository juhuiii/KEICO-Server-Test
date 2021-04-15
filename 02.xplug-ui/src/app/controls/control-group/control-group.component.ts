import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-control-group',
  templateUrl: './control-group.component.html',
  styleUrls: ['./control-group.component.scss'],
})
export class ControlGroupComponent implements OnInit {

  private timer1: any;
  groups = [];
  
  constructor(private api: ApiService) {
  }

  ngOnInit() {        
    this.timer1 = setInterval(() => { this.updateData(); }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timer1);
  }

  trackGroup(index, item) {
    return item.GRP_SQ;
  }

  updateData() { 

    let tmp = Object.assign([], this.api.groups);

    tmp.forEach(group => {

      let CNT_TOT = 0;
      let CNT_ON = 0;
      let CNT_OFF = 0;
      let CNT_ERR = 0;
      let SUM_KW  = 0;
      let STBY_KW = 0;

      let plugs = this.api.getPlugsByGroup(group['GRP_SQ']);

      plugs.forEach(plug => {
        CNT_TOT++;

        if( plug['DEV_ST'] !== 1 )  {
          CNT_ERR++;
        }
        else {
          if( plug['SW_ST'] === 1 ) {
            CNT_ON++;
            SUM_KW += plug['KW'];
            STBY_KW += plug['STBY_KW'];
          }
          else {
            CNT_OFF++;
          }
        }        
      });
 
      group['KW'     ] = SUM_KW;
      group['STBY_KW'] = STBY_KW;
      group['CNT_TOT'] = CNT_TOT;
      group['CNT_ON' ] = CNT_ON;
      group['CNT_OFF'] = CNT_OFF;
      group['CNT_ERR'] = CNT_ERR;
      group['GRP_ST' ] = (CNT_TOT==CNT_ERR) ? 0 : 1;
      group['SW_ST'  ] = (CNT_ON > 0) ? 1 : 0;
      
      group['ICON'   ] = 'assets/purple/icon_tellar.png';
    })

    
    tmp.sort( function(a,b) {
      if( a['GRP_NM'] > b['GRP_NM'] ) return 1;
      if( a['GRP_NM'] < b['GRP_NM'] ) return -1;
      return 0;
    })
    
    for (let i = tmp.length; i < 12; i++) {
      tmp.push({ GRP_ST: 9, SW_ST: 0 });
    }

    this.groups = tmp;
  }
}
