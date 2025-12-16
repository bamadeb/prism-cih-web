//import { Component } from '@angular/core';
// import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
// import {MatButtonModule} from '@angular/material/button';
 import {MatDialogModule} from '@angular/material/dialog';
 import { MatTabsModule } from '@angular/material/tabs';
// import {MatGridListModule} from '@angular/material/grid-list';
 import { MatRadioModule } from '@angular/material/radio';
 import { ConfigService } from '../../../../services/api.service';
 import { MatFormFieldModule } from '@angular/material/form-field';
 import { MatInputModule } from '@angular/material/input';
 import { MatSelectModule } from '@angular/material/select';
// //import { MatRadioModule } from '@angular/material/radio';
 import { MatDatepickerModule } from '@angular/material/datepicker';
// import { MatNativeDateModule } from '@angular/material/core';
 import { ChangeDetectorRef } from '@angular/core';
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { UserIdRequest } from '../../../../models/requests/userIdRequest';
import { UserDataService } from '../../../../services/user-data-service';
@Component({
  selector: 'app-add-action',
  imports: [
    MatButtonModule, 
     MatDialogModule, 
     MatTabsModule, 
    // MatGridListModule, 
     MatRadioModule, 
     MatFormFieldModule, 
     MatInputModule, 
     MatSelectModule,
     MatDatepickerModule,
    // MatNativeDateModule,
    // MatDialogActions,
    // MatDialogClose,
    // MatDialogContent,
    // MatDialogTitle
      MatTableModule,
      MatExpansionModule,
      MatCheckboxModule
  ],
  providers: [
    provideNativeDateAdapter()   // <-- REQUIRED FIX
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-action.html',
  styleUrl: './add-action.css',
})
export class AddAction {
  action_activity_category: any[] = [];
  action_ativity_type: any[] = [];
  navigatorList: any[] = [];
  actionresult_followup_list: any[] = [];
  memberTaskList: any[] = [];  
  cihpcrList: any[] = [];
  pcrColumns: string[] = [
  'DISCHARGE_CC_DESC_1',
  'DISCHARGE_CC_DESC_2',
  'DISCHARGE_CC_DESC_3',
  'DISCH_ORDER',
  'INDEX_ADMIT_DT',
  'INDEX_DISCH_DT',
  'INDEX_STAY',
  'NUMER',
  'READMISSION',
  'READMT_ADMIT_DT',
  'READMT_DISCH_DT'
];
taskColumns: string[] = ['action_type','action_date','status','initial','action_note'];
isLoading: boolean = false;
userId: string | null = null;
  readonly dialog = inject(MatDialog);
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private userData: UserDataService
  ) {}
 async ngOnInit(): Promise<void> {
  const user = this.userData.getUser();
  this.userId = user.ID;
 const result = await this.apiService.addActionMaster<any>(); 
    this.action_activity_category = result.data.actionActivityCategory || [];
            this.action_ativity_type = result.data.actionActivityType || [];
           this.navigatorList = result.data.navigatorList || [];
           
           this.cdr.detectChanges();
  }
    openDialog() {
      // const dialogRef = this.dialog.open(AddAction);

      // dialogRef.afterClosed().subscribe(result => {
      //   console.log(`Dialog result: ${result}`);
      // });
    }
    add_update_action_submit(){

    }
    toggleRiskGaps(){

    }
    getMemberGapsList(medicaid_id: string){
      const payload = { medicaid_id: medicaid_id };
      //console.log(payload);
      this.isLoading = true;
      const request: UserIdRequest = {
          user_id: '1' 
        };
      const result = this.apiService.getMemberGapsList<any>(request); 
      // this.apiService.post<ApiResponseMemberGapsList>('prismGetMemberGapsList', payload)
      //   .subscribe({
      //     next: (res) => {
      //       //this.commonApiRes = res;
      //       //console.log(res);
      //       if (res.data) {
      //         this.memberGapList = res.data.prismGapList || [];
      //         this.memberQualityList = res.data.prismQualityList || [];
      //         this.cihpcrList = res.data.prismCihPcrList || [];
      //         this.memberGapList = (res.data.prismGapList || []).map(gap => ({
      //           ...gap,
      //           Observation_Date: this.formatDateToMDY(gap.Observation_Date)
      //         }));
      //         this.memberQualityList = (res.data.prismQualityList || []).map(qgap => ({
      //           ...qgap,
      //           Observation_Date: this.formatDateToMDY(qgap.Observation_Date)
      //         }));            

      //         console.log(this.cihpcrList);
      //         this.setRiskGapsData(this.memberGapList);
      //         this.setQualityGapsData(this.memberQualityList);
      //         //this.actionresult_followup_list = res.data;
      //       } else {
      //         console.warn('⚠️ No data found:', res);
      //       }
      //     },
      //     error: (err) => {
      //       console.error('❌ Dashboard load failed:', err);
      //       //alert('Server error. Please try again later.');
      //     },
      //     complete: () => {
      //       this.isLoading = false;
      //     }
      //   });  
    }  
}

