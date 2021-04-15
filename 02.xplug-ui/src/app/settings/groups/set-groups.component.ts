import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { XgModalService } from 'src/app/commonUX/xg-modal.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-set-groups',
  templateUrl: './set-groups.component.html',
  styleUrls: ['./set-groups.component.scss']
})
export class SetGroupsComponent implements OnInit {

  constructor(private api: ApiService, private modal: XgModalService,
    private router: Router  
    ) { }

  result = [];


  ngOnInit() {
    this.onReflesh();    
  }

  onReflesh() {
    this.api.getGroups().subscribe(data => {
      console.log("this.api.getGroups().subscribe ");
      if (data['rcd'] === 0) {
        this.result = data['data'];
      }
      console.log(data);
    }, error => {
      console.log(error);
    });
  }

  createGroup()
  {        
    this.modal.openAddGroup("그룹등록", "").subscribe(result => {
     
      if (this.api.isEmpty(result) || this.api.isEmpty(result["result"]) )  return; 

      if( result["result"] )
      {
        let nGroup  = { GRP_NM : result["GRP_NM"] , BIGO:'' };
        this.api.addGroup(nGroup).subscribe( res => {        
         
          this.onReflesh() ;          
        },
        err => {          
          this.modal.alert( "그룹등록", "저장 되지 않았습니다. 관리자 문의 바랍니다." );
          console.log("Error occured");
        });        
      }
    });
    
  }


  goGroupDetail( GRP_SQ )
  {    
    this.router.navigate(['/app/settings/set-groups', GRP_SQ]);          
  }

  goScheduleDetail( GRP_SQ )
  {
    this.router.navigate(['/app/settings/set-groups/set-schedules', GRP_SQ]);          
  }  
  
}
