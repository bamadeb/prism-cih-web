import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PcrFile } from './pcr-file';

describe('PcrFile', () => {
  let component: PcrFile;
  let fixture: ComponentFixture<PcrFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PcrFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PcrFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
