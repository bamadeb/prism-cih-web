import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RiskgapsFile } from './riskgaps-file';

describe('RiskgapsFile', () => {
  let component: RiskgapsFile;
  let fixture: ComponentFixture<RiskgapsFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskgapsFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RiskgapsFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
