import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QualitygapsFile } from './qualitygaps-file';

describe('QualitygapsFile', () => {
  let component: QualitygapsFile;
  let fixture: ComponentFixture<QualitygapsFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QualitygapsFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QualitygapsFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
