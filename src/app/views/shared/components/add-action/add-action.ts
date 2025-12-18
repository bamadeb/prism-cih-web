//import { Component } from '@angular/core';
// import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
// import {MatButtonModule} from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
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
import { ChangeDetectorRef, Inject } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
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
import { UserIdRequest, MedicaidIdRequest } from '../../../../models/requests/commonRequest';
import { UserDataService } from '../../../../services/user-data-service';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
    MatCheckboxModule,
    MatExpansionModule,
    ReactiveFormsModule,

    CommonModule
  ],
  providers: [
    provideNativeDateAdapter()   // <-- REQUIRED FIX
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-action.html',
  styleUrl: './add-action.css',
})
export class AddAction {
  addActionFormGroup!: FormGroup;
  action_activity_category: any[] = [];
  action_ativity_type: any[] = [];
  navigatorList: any[] = [];
  actionresult_followup_list: any[] = [];
  memberTaskList: any[] = [];
  memberGapList: any[] = [];
  memberQualityList: any[] = [];
  //riskGapsList: any[] = [];

  //await
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
  taskColumns: string[] = ['action_type', 'action_date', 'status', 'initial', 'action_note'];
  isLoading: boolean = false;
  userId: string | null = null;
  medicaid_id: string | null = null;
  member_name: string | null = null;
  member_dob: string | null = null;
  readonly dialog = inject(MatDialog);
  addActionChangeFlag = 0;
  constructor(
    private apiService: ConfigService,
    private cdr: ChangeDetectorRef,
    private userData: UserDataService,
    @Inject(MAT_DIALOG_DATA) public data: any,

    private fb: FormBuilder
  ) {
    // this.form = this.fb.group({
    //   riskGapsList: this.fb.array([])
    // });
    this.addActionFormGroup = this.fb.group({
      // CURRENT ACTIVITY
      action_id: [18],
      panel_id: [17],
      action_date: [new Date()],
      action_status: ['Success'],
      action_result_id: [''],
      action_note: [''],

      // NEXT ACTIVITY
      next_panel_id: [''],
      next_action_date: [''],
      next_action_note: [''],

      //Member level
      medicaid_id: [''],
      action_type_source: ['Member Action'],
      // RISK GAPS
      riskGapsList: this.fb.array([]),
      qualityGapsList: this.fb.array([])
    });

    this.medicaid_id = data?.medicaid_id;
    this.member_name = data?.member_name;
    this.member_dob = data?.member_dob;
    if (this.medicaid_id) {
      this.addActionFormGroup.patchValue({
        medicaid_id: this.medicaid_id
      });
      this.getMemberTaskList(this.medicaid_id);
      this.getMemberGapsList(this.medicaid_id);
    }
    //alert(this.medicaid_id);
  }
  async ngOnInit(): Promise<void> {
    const user = this.userData.getUser();
    this.userId = user.ID;
    const result = await this.apiService.addActionMaster<any>();
    this.action_activity_category = result.data.actionActivityCategory || [];
    this.action_ativity_type = result.data.actionActivityType || [];
    this.navigatorList = result.data.navigatorList || [];
   this.setScheduledActionStatus('17');
    this.cdr.detectChanges();
    // this.form = this.fb.group({
    //   riskGapsList: this.fb.array([])
    // });qualityGapsList
  }
  get riskGapsList(): FormArray {
    return this.addActionFormGroup.get('riskGapsList') as FormArray;
  }
  get qualityGapsList(): FormArray {
    return this.addActionFormGroup.get('qualityGapsList') as FormArray;
  }
  async setScheduledActionStatus(id: string) {
   const user = this.userData.getUser();
    //console.log('Dashboard:', user);
   // if(user.role_id == 7){
    const role_id = user.role_id;
    const payload = { scheduled_type: id, role_id: role_id };
    const result = await this.apiService.getActionresultfollowup<any>(payload);
    //console.log(payload);
    this.actionresult_followup_list = result.data;
    
  }  
  createRiskGapForm(gap: any): FormGroup {
    return this.fb.group({
      PROCESS_STATUS: [false],
      DIAG_DESC: [gap.DIAG_DESC],
      DIAG_CODE: [gap.DIAG_CODE],
      risk_gap_id: [gap.risk_gap_id],

      Observation_Date: [gap.Observation_Date],
      Observation_Code: [gap.Observation_Code],
      CPT_Code_Modifier: [gap.CPT_Code_Modifier],
      Observation_Code_Set: [gap.Observation_Code_Set],
      Observation_Result: [gap.Observation_Result],

      Service_Provider_NPI: [gap.Service_Provider_NPI],
      Service_Provider_Taxonomy_Code: [gap.Service_Provider_Taxonomy_Code],
      Service_Provider_Name: [gap.Service_Provider_Name],
      Service_Provider_Type: [gap.Service_Provider_Type],
      Service_Provider_RxProviderFlag: [gap.Service_Provider_RxProviderFlag],

      Provider_Group_NPI: [gap.Provider_Group_NPI],
      Provider_Group_Taxonomy_Code: [gap.Provider_Group_Taxonomy_Code],
      Provider_Group_Name: [gap.Provider_Group_Name],

      note: [gap.note]
    });
  }

  openDialog() {
    // const dialogRef = this.dialog.open(AddAction);

    // dialogRef.afterClosed().subscribe(result => {
    //   console.log(`Dialog result: ${result}`);
    // });
  }
  async add_update_action_submit() {
    // alert(this.addActionFormGroup.invalid);
    // if (this.addActionFormGroup.invalid) {
    //   this.addActionFormGroup.markAllAsTouched(); // show validation errors
    //   return;
    // }
    // alert(2);
    //const user = this.auth.getUser();
    const formValues = this.addActionFormGroup.value;
    const action_id = formValues.update_action_id;
    //console.log(formValues);
    this.isLoading = true; // 🔹 show loader
    this.addActionChangeFlag = 1;

    if (!action_id) {
      const insert_data = {
        medicaid_id: formValues.medicaid_id,
        action_type_source: formValues.action_type_source,
        action_id: formValues.action_id,
        panel_id: formValues.panel_id,
        action_date: formValues.action_date,
        action_status: formValues.action_status,
        add_by: this.userId || '', // if you store user info in authService/session
        action_note: formValues.action_note,
        action_result_id: formValues.action_result_id,
      };

      const apiPayload = {
        table_name: 'MEM_MEMBER_ACTION_FOLLOW_UP',
        insertDataArray: [insert_data],
      };
      try {
        const result = await this.apiService.multipleRowInsert<any>(apiPayload);
        const action_id = result.insertedIds;
        const next_panel_id = formValues.next_panel_id;

        // ✅ 2️⃣ Insert NEXT TASK (if exists)
        if (next_panel_id) {
          const taskPayload = {
            table_name: 'MEM_TASK_FOLLOW_UP',
            insertDataArray: [
              {
                medicaid_id: formValues.medicaid_id,
                action_id: next_panel_id,
                action_date: formValues.next_action_date,
                action_note: formValues.next_action_note,
                status: 'Open',
                assign_to: this.userId,
                add_by: this.userId,
              },
            ],
          };

          await this.apiService.multipleRowInsert<any>(taskPayload);
        }
        //this.insertSystemLog(formValues);
        this.updateQualityAndRiskData(formValues, action_id);
        //console.log('insert call:', result)
      } catch (error) {
        console.log('error:' + error);
      } finally {
        this.isLoading = false;
      }

      // console.log('📤 API Payload:', apiPayload);
      // this.apiService.post('prismMultipleinsert', apiPayload).subscribe({
      //     next: (res: any) => {
      //       //console.log('✅ Data inserted:', res);
      //       if (res?.insertedIds) {
      //         const action_id = res.insertedIds;
      //         const next_panel_id = formValues.next_panel_id;
      //         if (next_panel_id) {
      //           const taskPayload = {
      //             table_name: 'MEM_TASK_FOLLOW_UP',
      //             insertDataArray: [
      //               {
      //                 medicaid_id: formValues.medicaid_id,
      //                 action_id: next_panel_id,
      //                 action_date: formValues.next_action_date,
      //                 action_note: formValues.next_action_note,
      //                 status: 'Open',
      //                 assign_to: this.userId,
      //                 add_by: this.userId,
      //               },
      //             ],
      //           };
      //           this.apiService.post('prismMultipleinsert', taskPayload).subscribe();
      //         }
      //         this.insertSystemLog(formValues);
      //         this.updateQualityAndRiskData(formValues, action_id); // ✅ also call here
      //         //console.log('✅ New Action ID:', action_id);
      //       }
      //       //alert('Action saved successfully!');
      //     },
      //     error: (err) => {
      //       console.error('❌ Error inserting action:', err);
      //       alert('Failed to save create a action!');
      //     },
      // });

    } else {
      // === UPDATE MODE ===
      const updateData = {
        action_type_source: formValues.action_type_source,
        action_id: formValues.action_id,
        panel_id: formValues.panel_id,
        action_date: formValues.action_date,
        action_status: formValues.action_status,
        action_note: formValues.action_note,
        action_result_id: formValues.action_result_id,
      };

      const params = {
        updateData,
        table_name: 'MEM_MEMBER_ACTION_FOLLOW_UP',
        id_field_name: 'id',
        id_field_value: action_id,
      };

      // this.apiService.post('prismMultiplefieldupdate', params).subscribe({
      //   next: () => {
      //         this.insertSystemLog(formValues);
      //         this.updateQualityAndRiskData(formValues, action_id); // ✅ also call here
      //         //alert('Action updated successfully!');
      //       },
      //       error: (err) => {
      //         console.error('❌ Error updating action:', err);
      //         alert('Failed to update a action!');
      //       },
      //       complete: () => {
      //         this.isLoading = false;
      //       }
      //   });

    }


    //console.log('Form Submitted ✅', this.addActionFormGroup.value);  
    //alert(88);
  }
private async updateQualityAndRiskData(
  formValues: any,
  action_id: number
): Promise<void> {

  const medicaid_id = formValues.medicaid_id;

  const diagCodes: string[] = [];
  const qualitySubMeasures: string[] = [];
  const riskObsInsertArray: any[] = [];
  const riskObsUpdateArray: any[] = [];

  /* ----------------------------------
     BUILD RISK GAP DATA
  -----------------------------------*/
  if (formValues.riskGapsList?.length) {
    formValues.riskGapsList.forEach((riskGap: any) => {

      const processStatus = riskGap.PROCESS_STATUS;
      if ((processStatus === true || processStatus === '1') && riskGap.DIAG_CODE) {
        diagCodes.push(riskGap.DIAG_CODE);
      }

      const commonData = {
        medicaid_id,
        Type: riskGap.Type,
        Gap_Code: riskGap.DIAG_CODE,
        Observation_Date: riskGap.Observation_Date,
        Observation_Year: new Date(riskGap.Observation_Date).getFullYear(),
        Observation_Code: riskGap.Observation_Code,
        CPT_Code_Modifier: riskGap.CPT_Code_Modifier,
        Observation_Code_Set: riskGap.Observation_Code_Set,
        Observation_Result: riskGap.Observation_Result,
        Service_Provider_NPI: riskGap.Service_Provider_NPI,
        Service_Provider_Taxonomy_Code: riskGap.Service_Provider_Taxonomy_Code,
        Service_Provider_Name: riskGap.Service_Provider_Name,
        Service_Provider_Type: riskGap.Service_Provider_Type,
        Service_Provider_RxProviderFlag: riskGap.Service_Provider_RxProviderFlag,
        Provider_Group_NPI: riskGap.Provider_Group_NPI,
        Provider_Group_Taxonomy_Code: riskGap.Provider_Group_Taxonomy_Code,
        Provider_Group_Name: riskGap.Provider_Group_Name,
        Source: 'CIH',
        note: riskGap.note
      };

      if (riskGap.risk_gap_id) {
        riskObsUpdateArray.push({
          ...commonData,
          id: riskGap.risk_gap_id,
          updated_date: new Date()
        });
      } else {
        const hasValue = Object.values(commonData).some(v => v);
        if (hasValue) {
          riskObsInsertArray.push({
            ...commonData,
            added_date: new Date()
          });
        }
      }
    });
  }

  /* ----------------------------------
     BUILD QUALITY GAP DATA
  -----------------------------------*/
  if (formValues.qualityGapsList?.length) {
    formValues.qualityGapsList.forEach((qualityGap: any) => {

      const processStatus = qualityGap.PROCESS_STATUS;
      if ((processStatus === true || processStatus === '1') && qualityGap.SUB_MEASURE) {
        qualitySubMeasures.push(qualityGap.SUB_MEASURE);
      }

      const commonData = {
        medicaid_id,
        Type: qualityGap.Type,
        Gap_Code: qualityGap.SUB_MEASURE,
        Observation_Date: qualityGap.Observation_Date,
        Observation_Year: new Date(qualityGap.Observation_Date).getFullYear(),
        Observation_Code: qualityGap.Observation_Code,
        CPT_Code_Modifier: qualityGap.CPT_Code_Modifier,
        Observation_Code_Set: qualityGap.Observation_Code_Set,
        Observation_Result: qualityGap.Observation_Result,
        Service_Provider_NPI: qualityGap.Service_Provider_NPI,
        Service_Provider_Taxonomy_Code: qualityGap.Service_Provider_Taxonomy_Code,
        Service_Provider_Name: qualityGap.Service_Provider_Name,
        Service_Provider_Type: qualityGap.Service_Provider_Type,
        Service_Provider_RxProviderFlag: qualityGap.Service_Provider_RxProviderFlag,
        Provider_Group_NPI: qualityGap.Provider_Group_NPI,
        Provider_Group_Taxonomy_Code: qualityGap.Provider_Group_Taxonomy_Code,
        Provider_Group_Name: qualityGap.Provider_Group_Name,
        Source: 'CIH',
        note: qualityGap.note
      };

      if (qualityGap.quality_gap_id) {
        riskObsUpdateArray.push({
          ...commonData,
          id: qualityGap.quality_gap_id,
          updated_date: new Date()
        });
      } else {
        const hasValue = Object.values(commonData).some(v => v);
        if (hasValue) {
          riskObsInsertArray.push({
            ...commonData,
            added_date: new Date()
          });
        }
      }
    });
  }

  try {
    /* ----------------------------------
       STEP 1: UNSET MEMBER GAP STATUS
    -----------------------------------*/
    const paramsunsetq = {
      medicaid_id: medicaid_id,
      action_id: action_id
    };
     const result = await this.apiService.unSetMemberGapsStatus<any>(paramsunsetq);
    // await this.apiService.post('prismUnSetMemberGapsStatus', {
    //   medicaid_id,
    //   action_id
    // }).toPromise();

    /* ----------------------------------
       STEP 2: UPDATE RISK STATUS
    -----------------------------------*/
        const diagVal = diagCodes.length > 0 ? `'${diagCodes.join("','")}'` : '';
        const paramsupdate = {
          medicaid_id: medicaid_id,
          diag_codes: diagVal,
          action_id: action_id
        };   
     const updategapresult = await this.apiService.updategapStatus<any>(paramsupdate);         
    // await this.apiService.post('prismUpdategapStatus', {
    //   medicaid_id,
    //   diag_codes: diagCodes.length ? `'${diagCodes.join("','")}'` : '',
    //   action_id
    // }).toPromise();

    /* ----------------------------------
       STEP 3: UPDATE QUALITY STATUS
    -----------------------------------*/
        const subMeasureVal = qualitySubMeasures.length > 0 ? `'${qualitySubMeasures.join("','")}'` : '';
        const qualityparamsupdate = {
          medicaid_id: medicaid_id,
          measur_code_val: subMeasureVal,
          action_id: action_id
        };    
     const updatequalitygapresult = await this.apiService.updatequalityStatus<any>(qualityparamsupdate);  
     /// await this.apiService.post('prismUpdatequalityStatus', {
    //   medicaid_id,
    //   measur_code_val: qualitySubMeasures.length
    //     ? `'${qualitySubMeasures.join("','")}'`
    //     : '',
    //   action_id
    // }).toPromise();

    /* ----------------------------------
       STEP 4: UPDATE OBSERVATIONS
    -----------------------------------*/
    if (riskObsUpdateArray.length) {
          const apiparamUpdate = {
            table_name: "MEM_GAP_OBSERVATION_DATA",
            id_field_name: "id",
            updates: riskObsUpdateArray
          };
     const updatequalitygapresult = await this.apiService.multipleRowAndFieldUpdate<any>(apiparamUpdate);            
      // await this.apiService.post(
      //   'prismMultipleRowAndFieldUpdate',
      //   {
      //     table_name: 'MEM_GAP_OBSERVATION_DATA',
      //     id_field_name: 'id',
      //     updates: riskObsUpdateArray
      //   }
      // ).toPromise();
    }

    /* ----------------------------------
       STEP 5: INSERT OBSERVATIONS
    -----------------------------------*/
    if (riskObsInsertArray.length) {
      await this.apiService.multipleRowInsert({
        table_name: 'MEM_GAP_OBSERVATION_DATA',
        insertDataArray: riskObsInsertArray
      });
    }
alert('Successfuly to save data');
    /* ----------------------------------
       FINAL UI CLEANUP
    -----------------------------------*/
    // this.showFlash('Saved Successfully!');
    // this.modalInstance?.hide();

    // setTimeout(() => {
    //   this.openModal(medicaid_id, this.member_name, this.dbirth);
    // }, 300);

  } catch (error) {
    console.error('❌ Error updating quality/risk data:', error);
    alert('Failed to save data');
  } finally {
    this.isLoading = false;
  }
}

  toggleRiskGaps() {

  }
  async getMemberTaskList(medicaid_id: string) {

    //alert(medicaid_id);
    this.isLoading = true;
    const request: MedicaidIdRequest = {
      medicaid_id: medicaid_id
    };
    const result = await this.apiService.getMemberTaskList<any>(request);
    this.memberTaskList = result.data || [];
    console.log('Task result:', result);
  }
  async getMemberGapsList(medicaid_id: string) {
    const payload = { medicaid_id: medicaid_id };
    //console.log(payload);getMemberTaskList
    this.isLoading = true;
    const request: MedicaidIdRequest = {
      medicaid_id: medicaid_id
    };
    const result = await this.apiService.getMemberGapsList<any>(request);
    //this.riskGapsList = result.data.prismGapList || [];
    //console.log('Gaps result:', result);
    this.cihpcrList = result.data.prismCihPcrList || [];
    this.memberGapList = (result.data.prismGapList || []).map((gap: { Observation_Date: string; }) => ({
      ...gap,
      Observation_Date: this.formatDateToMDY(gap.Observation_Date)
    }));
    this.memberQualityList = (result.data.prismQualityList || []).map((qgap: { Observation_Date: string; }) => ({
      ...qgap,
      Observation_Date: this.formatDateToMDY(qgap.Observation_Date)
    }));
    //this.riskGapsList.clear();
    this.setRiskGapsData(this.memberGapList);
    this.setQualityGapsData(this.memberQualityList);
    // (result.data.prismGapList || []).forEach((gap: any) => {
    //   this.riskGapsList.push(this.createRiskGapForm(gap));
    //   console.log('Gaps:',gap);
    // });

    console.log('riskGapsList:', this.riskGapsList);
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
  setRiskGapsData(riskGapsdata: any) {
    // Clear existing transactions
    this.riskGapsList.clear();

    if (riskGapsdata && Array.isArray(riskGapsdata)) {
      riskGapsdata.forEach((t: any) => {
        this.riskGapsList.push(this.fb.group({
          DIAG_CODE: [this.sanitize(t.DIAG_CODE)],
          DIAG_DESC: [this.sanitize(t.DIAG_DESC)],
          PROCESS_STATUS: [t.PROCESS_STATUS === 1],
          risk_gap_id: [t.id],
          Type: ['risk'],
          Gap_Code: [this.sanitize(t.Gap_Code)],
          Observation_Date: [
            (t.Observation_Date && t.Observation_Date !== '1900-01-01T00:00:00.000Z' && t.Observation_Date !== '01/01/1900')
              ? new Date(t.Observation_Date)
              : ''
          ],
          Observation_Year: [this.sanitize(t.Observation_Year)],
          Observation_Code: [this.sanitize(t.Observation_Code)],
          CPT_Code_Modifier: [this.sanitize(t.CPT_Code_Modifier)],
          Observation_Code_Set: [this.sanitize(t.Observation_Code_Set)],
          Observation_Result: [this.sanitize(t.Observation_Result)],
          Service_Provider_NPI: [this.sanitize(t.Service_Provider_NPI)],
          Service_Provider_Taxonomy_Code: [this.sanitize(t.Service_Provider_Taxonomy_Code)],
          Service_Provider_Name: [this.sanitize(t.Service_Provider_Name)],
          Service_Provider_Type: [this.sanitize(t.Service_Provider_Type)],
          Service_Provider_RxProviderFlag: [this.sanitize(t.Service_Provider_RxProviderFlag)],
          Provider_Group_NPI: [this.sanitize(t.Provider_Group_NPI)],
          Provider_Group_Taxonomy_Code: [this.sanitize(t.Provider_Group_Taxonomy_Code)],
          Provider_Group_Name: [this.sanitize(t.Provider_Group_Name)],
          note: [this.sanitize(t.note)]
        }));
      });
      //console.log(riskGapsdata);
    }
  }
  sanitize(value: any) {
    return value === null || value === undefined || value === 'null' ? '' : value;
  }
  setQualityGapsData(qualityGapsdata: any) {
    // Clear existing list
    this.qualityGapsList.clear();

    if (qualityGapsdata && Array.isArray(qualityGapsdata)) {
      qualityGapsdata.forEach((t: any) => {
        this.qualityGapsList.push(
          this.fb.group({
            SUB_MEASURE: [this.sanitize(t.SUB_MEASURE)],
            MEASURE_NAME: [this.sanitize(t.MEASURE_NAME)],
            PROCESS_STATUS: [t.PROCESS_STATUS === 1],
            quality_gap_id: [t.id],
            Type: ['quality'],
            Gap_Code: [this.sanitize(t.Gap_Code)],

            // Handle invalid dates
            Observation_Date: [
              t.Observation_Date &&
                t.Observation_Date !== '1900-01-01T00:00:00.000Z' &&
                t.Observation_Date !== '01/01/1900'
                ? t.Observation_Date
                : ''
            ],

            Observation_Year: [this.sanitize(t.Observation_Year)],
            Observation_Code: [this.sanitize(t.Observation_Code)],
            CPT_Code_Modifier: [this.sanitize(t.CPT_Code_Modifier)],
            Observation_Code_Set: [this.sanitize(t.Observation_Code_Set)],
            Observation_Result: [this.sanitize(t.Observation_Result)],
            Service_Provider_NPI: [this.sanitize(t.Service_Provider_NPI)],
            Service_Provider_Taxonomy_Code: [this.sanitize(t.Service_Provider_Taxonomy_Code)],
            Service_Provider_Name: [this.sanitize(t.Service_Provider_Name)],
            Service_Provider_Type: [this.sanitize(t.Service_Provider_Type)],
            Service_Provider_RxProviderFlag: [this.sanitize(t.Service_Provider_RxProviderFlag)],
            Provider_Group_NPI: [this.sanitize(t.Provider_Group_NPI)],
            Provider_Group_Taxonomy_Code: [this.sanitize(t.Provider_Group_Taxonomy_Code)],
            Provider_Group_Name: [this.sanitize(t.Provider_Group_Name)],
            note: [this.sanitize(t.note)]
          })
        );
      });
    }
  }
  formatDateToMDY(dateStr: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`; // m/d/Y format
  }
  formatDateToYMD(dateStr: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${year}-${month}-${day}`; // m/d/Y format
  }
}

