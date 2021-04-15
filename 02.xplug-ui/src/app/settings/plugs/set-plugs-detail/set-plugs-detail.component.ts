import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { XgModalService } from 'src/app/commonUX/xg-modal.service';


@Component({
  selector: 'app-set-plugs-detail',
  templateUrl: './set-plugs-detail.component.html',
  styleUrls:  ['./set-plugs-detail.component.scss']
})
export class SetPlugsDetailComponent implements OnInit {

  private zb_addr : string ;
  public  plug : {};

  public VALID_DEV_NM : string = "none";
  
  constructor( 
    public api: ApiService, 
    public modal: XgModalService,
    private activatedRoute: ActivatedRoute,  
    private router: Router  ,
    ) { 
    this.zb_addr = activatedRoute.snapshot.params["ZB_ADDR"];
    console.log("zbaddr : " +  this.zb_addr );
  }
  
  ngOnInit() {
    console.log(this.zb_addr); 
    
    this.plug = Object.assign({}, this.api.getPlug( this.zb_addr) );    //Clone Object

    console.log(this.plug);
  }  


  //16BIT Addreess 확인 요청 보내기 
  goSetNetworkAddr(){
    
    this.api.setNetworkAddr(this.zb_addr).subscribe( res => {        

      this.modal.alert( "Network(16 BIT) 주소 요청", "요청완료" );

    },
    err => {        
      this.modal.alert( "Network(16 BIT) 주소 요청", "요청을 실패 하였습니다." );
      
      console.log("Error occured");
    });
  }

  //Report 주기 설정 
  goSetReportConfig(){

    this.api.setReportConfig(this.zb_addr, 0, 1, 65534, 1 ).subscribe( res => {      

      this.modal.alert( "set on/off Report", "요청완료" );

    },
    err => {        
      this.modal.alert( "Report 주기 설정", "요청을 실패 하였습니다." );
      
      console.log("Error occured");
    });

  }
   
  
  goUpdate()
  {
    this.VALID_DEV_NM = "none";

    if( this.plug["MANU_CTL_ALLOW"] )  this.plug["MANU_CTL_ALLOW"] = 1;
    else                               this.plug["MANU_CTL_ALLOW"] = 0;     

    if( this.plug["DEV_NM"] === undefined || this.plug["DEV_NM"] === null || this.plug["DEV_NM"] == "" )
    {
      this.VALID_DEV_NM = "";
      return;
    }




    this.api.updatePlug(this.plug).subscribe( res => {        

        this.modal.alert( "플러그설정", "저장되었습니다." );

        this.api.reload();
      },
      err => {        
        this.modal.alert( "플러그설정", "저장 되지 않았습니다. 관리자 문의 바랍니다." );
        
        console.log("Error occured");
      }
    );
  }






  
  goDelete()
  {
    const initialState = {      
      title : "삭제", 
      message  : "정말 삭제 하시겠니까?" ,
      confirmBtnName : "삭제",
      declineBtnName : "취소"
    };

    this.modal.openConfirm(initialState).then( success => {      
      console.log( "OK", initialState );

      this.api.deletePlug(this.plug).subscribe( res => {        
          this.router.navigate(['/app/settings/set-plugs']);        
      },
      err => {
        
        this.modal.alert( "플러그삭제", "삭제 되지 않았습니다. 관리자 문의 바랍니다." );        
       
      });

      
    }).catch( ()=>{
      console.log( "Cancle", initialState );
    });
  }

  goBack()
  {
    this.router.navigate(['/app/settings/set-plugs']);
  }
}
