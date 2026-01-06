import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberFile } from './member-file';

describe('MemberFile', () => {
  let component: MemberFile;
  let fixture: ComponentFixture<MemberFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
